const STORAGE_PREFIX = "vinny-auto-applied:";

/** Auto-approve re-mounts every edit/command from the entire chat history
 * on every page load (the full history is re-parsed each render), not just
 * ones genuinely new this session. Without this guard, a refresh would
 * silently re-write every file, re-commit/push, and even re-run shell
 * commands for everything ever proposed in the whole conversation.
 * sessionStorage marks an id as already handled - cleared only when the
 * tab/window closes, which matches "don't redo this on a refresh" exactly. */
export function wasAlreadyAutoApplied(id: string): boolean {
  try {
    return sessionStorage.getItem(STORAGE_PREFIX + id) === "1";
  } catch {
    return false;
  }
}

export function markAutoApplied(id: string): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + id, "1");
  } catch {
    // Private browsing / storage disabled - worst case it re-runs once more.
  }
}
