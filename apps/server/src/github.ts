import { exec } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { simpleGit } from "simple-git";
import { env } from "./env.js";

const CLONE_TIMEOUT_MS = 5 * 60_000;
const REPOS_DIR = join(dirname(env.DATABASE_PATH), "repos");

export class CloneError extends Error {}

function sanitizeName(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "repo";
}

/** Derives a default project name from a repo URL, e.g.
 * "https://github.com/owner/my-repo.git" -> "my-repo". */
function deriveName(url: string): string {
  const withoutGit = url.replace(/\.git$/, "");
  const last = withoutGit.split("/").filter(Boolean).pop();
  return sanitizeName(last ?? "repo");
}

function uniqueDestination(name: string): string {
  mkdirSync(REPOS_DIR, { recursive: true });
  let candidate = join(REPOS_DIR, name);
  let suffix = 2;
  while (existsSync(candidate)) {
    candidate = join(REPOS_DIR, `${name}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

/** Strips any embedded credential (https://TOKEN@host/...) out of error
 * text before it's ever logged or sent back to the client. */
function sanitizeMessage(message: string): string {
  return message.replace(/https:\/\/[^@\s/]+@/g, "https://");
}

export interface ClonedProject {
  name: string;
  path: string;
}

export interface CreatedRepo {
  htmlUrl: string;
  cloneUrl: string;
}

/** Creates a new repo on the signed-in user's GitHub account (Vicevinnybeats,
 * or whoever the token belongs to) - used so a brand-new "Local folder" chat
 * lands on GitHub automatically instead of staying local-only. */
export async function createRepo(
  name: string,
  token: string,
  isPrivate: boolean,
): Promise<CreatedRepo> {
  const repoName = sanitizeName(name);
  let response: Response;
  try {
    response = await fetch("https://api.github.com/user/repos", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "vinny-editor",
      },
      body: JSON.stringify({ name: repoName, private: isPrivate }),
    });
  } catch {
    throw new CloneError("Couldn't reach GitHub to create the repo.");
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    if (response.status === 401) {
      throw new CloneError("That GitHub token was rejected - check it in Settings.");
    }
    throw new CloneError(
      body.message
        ? `GitHub rejected that repo: ${body.message}`
        : `Couldn't create the GitHub repo (GitHub returned ${response.status}).`,
    );
  }

  const data = (await response.json()) as { html_url: string; clone_url: string };
  return { htmlUrl: data.html_url, cloneUrl: data.clone_url };
}

/** Turns a plain local folder into a git repo (if it isn't one already),
 * points it at a freshly-created GitHub repo, and pushes whatever's there.
 * An empty folder is left with no commits - the GitHub repo still exists
 * and is linked, there's just nothing to push yet. */
export async function initAndPushNewRepo(
  localPath: string,
  cloneUrl: string,
  token: string,
): Promise<void> {
  let authedUrl: string;
  try {
    const parsed = new URL(cloneUrl);
    parsed.username = token;
    authedUrl = parsed.toString();
  } catch {
    throw new CloneError("That doesn't look like a valid repo URL.");
  }

  const git = simpleGit(localPath);
  try {
    if (!(await git.checkIsRepo())) {
      await git.init();
    }

    const remotes = await git.getRemotes();
    if (remotes.some((r) => r.name === "origin")) {
      await git.remote(["set-url", "origin", authedUrl]);
    } else {
      await git.addRemote("origin", authedUrl);
    }

    let hasCommit = true;
    try {
      await git.raw(["rev-parse", "HEAD"]);
    } catch {
      hasCommit = false;
    }

    if (!hasCommit) {
      await git.add(".");
      await git.commit("Initial commit");
      try {
        await git.raw(["rev-parse", "HEAD"]);
      } catch {
        // Empty folder - commit() no-ops instead of throwing. Leave it
        // linked but empty rather than pushing a branch that doesn't exist.
        return;
      }
    }

    const branch = (await git.status()).current || "main";
    await git.push(["-u", "origin", branch]);
  } catch (err) {
    throw new CloneError(
      sanitizeMessage(err instanceof Error ? err.message : "Couldn't set up git for this project."),
    );
  }
}

/** Clones a git repo (GitHub or otherwise) over HTTPS into a managed folder
 * next to the app's own database, then hands back a name/path pair to
 * register as a project. The token (for private repos) is used only to
 * build the one-off clone URL - it's never persisted. */
export function cloneRepo(url: string, token?: string, name?: string): Promise<ClonedProject> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!/^https:\/\//.test(url)) {
      rejectPromise(new CloneError("Only https:// repo URLs are supported (not git@ SSH URLs)."));
      return;
    }

    let cloneUrl = url;
    if (token) {
      try {
        const parsed = new URL(url);
        parsed.username = token;
        cloneUrl = parsed.toString();
      } catch {
        rejectPromise(new CloneError("That doesn't look like a valid URL."));
        return;
      }
    }

    const projectName = sanitizeName(name?.trim() || deriveName(url));
    const destination = uniqueDestination(projectName);

    exec(
      `git clone --depth 1 "${cloneUrl}" "${destination}"`,
      { timeout: CLONE_TIMEOUT_MS, maxBuffer: 2 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          rejectPromise(
            new CloneError(sanitizeMessage(stderr || error.message || "git clone failed")),
          );
          return;
        }
        resolvePromise({ name: projectName, path: destination });
      },
    );
  });
}
