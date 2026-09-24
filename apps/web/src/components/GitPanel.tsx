import { useEffect, useState } from "react";
import type { GitStatus } from "@vinny-editor/shared";
import { gitApi } from "../api";

export function GitPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<{ path: string; text: string } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function refresh() {
    void gitApi.status().then(setStatus);
  }

  useEffect(refresh, []);

  async function viewDiff(path: string, staged: boolean) {
    const res = await gitApi.diff(path, staged);
    setDiff({ path, text: res.diff });
  }

  async function stage(path: string) {
    await gitApi.stage(path);
    refresh();
  }

  async function unstage(path: string) {
    await gitApi.unstage(path);
    refresh();
  }

  async function commit() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      await gitApi.commit(message);
      setMessage("");
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <div className="git-panel muted">Loading git status...</div>;
  if (!status.isRepo) return <div className="git-panel muted">Not a git repository.</div>;

  return (
    <div className="git-panel">
      <div className="panel-title">Git &middot; {status.branch ?? "detached"}</div>
      <FileGroup
        title="Staged"
        files={status.staged}
        onClick={(p) => viewDiff(p, true)}
        action={{ label: "Unstage", run: unstage }}
      />
      <FileGroup
        title="Changes"
        files={status.unstaged}
        onClick={(p) => viewDiff(p, false)}
        action={{ label: "Stage", run: stage }}
      />
      <FileGroup
        title="Untracked"
        files={status.untracked}
        onClick={(p) => viewDiff(p, false)}
        action={{ label: "Stage", run: stage }}
      />

      {diff && (
        <div className="git-diff">
          <div className="git-diff-header">{diff.path}</div>
          <pre>{diff.text || "No textual diff."}</pre>
        </div>
      )}

      <div className="commit-box">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Commit message"
          rows={2}
        />
        <button className="btn btn-primary" onClick={commit} disabled={busy || !message.trim()}>
          Commit staged
        </button>
      </div>
    </div>
  );
}

function FileGroup({
  title,
  files,
  onClick,
  action,
}: {
  title: string;
  files: string[];
  onClick: (path: string) => void;
  action: { label: string; run: (path: string) => void };
}) {
  if (files.length === 0) return null;
  return (
    <div className="git-group">
      <div className="git-group-title">{title}</div>
      <ul>
        {files.map((path) => (
          <li key={path} className="git-file-row">
            <button className="git-file-name" onClick={() => onClick(path)}>
              {path}
            </button>
            <button className="btn btn-small" onClick={() => action.run(path)}>
              {action.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
