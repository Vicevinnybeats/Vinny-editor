import chokidar from "chokidar";
import { getSettings } from "./db.js";
import { hasStagedChanges, isGitRepo, commitStaged, pushCommits, stageAll } from "./git.js";
import { toWorkspaceRelative, getWorkspaceRoot } from "./workspace-fs.js";
import { broadcast } from "./ws-hub.js";

let currentWatcher: ReturnType<typeof chokidar.watch> | null = null;

// Auto-commit-and-push (Settings) previously only fired for edits made
// through Vinny's own chat (vinny-edit blocks) - a file changed by any other
// means (hand-edited in Notepad, created by a command Vinny ran, moved in
// File Explorer) never reached GitHub even with the setting on. Watching
// the whole workspace and auto-committing on any real change closes that
// gap, regardless of what touched the file. Debounced so a burst of
// changes (an npm install, a build, several quick edits) becomes one
// commit instead of one per file.
const AUTO_COMMIT_DEBOUNCE_MS = 4000;
let autoCommitTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutoCommit(): void {
  if (!getSettings().autoCommitAndPush) return;
  if (autoCommitTimer) clearTimeout(autoCommitTimer);
  autoCommitTimer = setTimeout(() => {
    autoCommitTimer = null;
    void runAutoCommit();
  }, AUTO_COMMIT_DEBOUNCE_MS);
}

async function runAutoCommit(): Promise<void> {
  try {
    if (!(await isGitRepo())) return;
    await stageAll();
    if (!(await hasStagedChanges())) return;
    await commitStaged("Auto-commit: workspace changes");
    await pushCommits();
  } catch {
    // Best-effort, same as the per-edit auto-commit in DiffApproval - no
    // remote, nothing to push, or a real push failure all just mean this
    // round is skipped rather than surfaced as an error.
  }
}

export function startWorkspaceWatcher() {
  const watcher = chokidar.watch(getWorkspaceRoot(), {
    ignored: (path) => /(^|[/\\])(\.git|node_modules)([/\\]|$)/.test(path),
    ignoreInitial: true,
  });

  const onChange = (path: string) => {
    broadcast({ type: "fs:changed", path: toWorkspaceRelative(path) });
    scheduleAutoCommit();
  };
  watcher.on("add", onChange);
  watcher.on("change", onChange);
  watcher.on("unlink", onChange);

  currentWatcher = watcher;
  return watcher;
}

/** Re-points the file watcher at the new active project's folder after a
 * project switch - a watcher can't be redirected to a different root once
 * started. */
export async function restartWorkspaceWatcher(): Promise<void> {
  // A pending auto-commit timer would otherwise fire against whichever
  // project happens to be active once it goes off, not the one that
  // actually changed - drop it, the new project's own future changes will
  // schedule their own.
  if (autoCommitTimer) {
    clearTimeout(autoCommitTimer);
    autoCommitTimer = null;
  }
  if (currentWatcher) {
    await currentWatcher.close();
    currentWatcher = null;
  }
  startWorkspaceWatcher();
}
