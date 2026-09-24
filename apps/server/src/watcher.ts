import chokidar from "chokidar";
import { toWorkspaceRelative, WORKSPACE_ROOT } from "./workspace-fs.js";
import { broadcast } from "./ws-hub.js";

export function startWorkspaceWatcher() {
  const watcher = chokidar.watch(WORKSPACE_ROOT, {
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

  return watcher;
}
