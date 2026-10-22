import { exec } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
