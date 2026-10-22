import chokidar from "chokidar";
import { toWorkspaceRelative, getWorkspaceRoot } from "./workspace-fs.js";
import { broadcast } from "./ws-hub.js";

let currentWatcher: ReturnType<typeof chokidar.watch> | null = null;

export function startWorkspaceWatcher() {
  const watcher = chokidar.watch(getWorkspaceRoot(), {
    ignored: (path) => /(^|[/\\])(\.git|node_modules)([/\\]|$)/.test(path),
    ignoreInitial: true,
  });

  watcher.on("add", (path) => broadcast({ type: "fs:changed", path: toWorkspaceRelative(path) }));
  watcher.on("change", (path) =>
    broadcast({ type: "fs:changed", path: toWorkspaceRelative(path) }),
  );
  watcher.on("unlink", (path) =>
    broadcast({ type: "fs:changed", path: toWorkspaceRelative(path) }),
  );

  currentWatcher = watcher;
  return watcher;
}

/** Re-points the file watcher at the new active project's folder after a
 * project switch - a watcher can't be redirected to a different root once
 * started. */
export async function restartWorkspaceWatcher(): Promise<void> {
  if (currentWatcher) {
    await currentWatcher.close();
    currentWatcher = null;
  }
  startWorkspaceWatcher();
}
