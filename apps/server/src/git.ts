import { simpleGit } from "simple-git";
import type { GitStatus } from "@vinny-editor/shared";
import { WORKSPACE_ROOT } from "./workspace-fs.js";

const git = simpleGit(WORKSPACE_ROOT);

export async function isGitRepo(): Promise<boolean> {
  try {
    return await git.checkIsRepo();
  } catch {
    return false;
  }
}

export async function getStatus(): Promise<GitStatus> {
  if (!(await isGitRepo())) {
    return {
      isRepo: false,
      branch: null,
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    };
  }

  const status = await git.status();
  const staged = new Set<string>();
  const unstaged = new Set<string>();
  const untracked = new Set<string>();

  for (const file of status.files) {
    if (file.working_dir === "?" && file.index === "?") {
      untracked.add(file.path);
      continue;
    }
    if (file.index !== " " && file.index !== "?") staged.add(file.path);
    if (file.working_dir !== " " && file.working_dir !== "?") unstaged.add(file.path);
  }

  return {
    isRepo: true,
    branch: status.current,
    ahead: status.ahead,
    behind: status.behind,
    staged: [...staged],
    unstaged: [...unstaged],
    untracked: [...untracked],
  };
}

export async function getDiff(path: string | undefined, staged: boolean): Promise<string> {
  const args = staged ? ["--cached"] : [];
  if (path) args.push("--", path);
  return git.diff(args);
}

export async function stageFile(path: string): Promise<void> {
  await git.add([path]);
}

export async function unstageFile(path: string): Promise<void> {
  await git.raw(["reset", "HEAD", "--", path]);
}

export async function commitStaged(message: string): Promise<void> {
  await git.commit(message);
}
