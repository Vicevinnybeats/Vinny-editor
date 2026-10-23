import { DiffEditor } from "@monaco-editor/react";
import { diffLines } from "diff";
import { useEffect, useMemo, useState } from "react";
import type { ProposedEdit } from "@vinny-editor/shared";
import { fsApi, gitApi } from "../api";
import { markAutoApplied, wasAlreadyAutoApplied } from "../autoApproveGuard";
import { useConnection } from "../connection";

function countLines(text: string): number {
  if (text === "") return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

export function DiffApproval({ id, edit }: { id: string; edit: ProposedEdit }) {
  const { settings } = useConnection();
  const autoApprove = settings?.autoApproveEdits ?? false;
  const alreadyApplied = wasAlreadyAutoApplied(id);
  const [original, setOriginal] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "applied" | "rejected" | "error">(
    alreadyApplied ? "applied" : "pending",
  );
  const [expanded, setExpanded] = useState(!autoApprove && !alreadyApplied);

  useEffect(() => {
    fsApi
      .file(edit.path)
      .then((res) => setOriginal(res.content))
      .catch(() => setOriginal(""));
  }, [edit.path]);

  const stats = useMemo(() => {
    if (original === null) return null;
    let added = 0;
    let removed = 0;
    for (const part of diffLines(original, edit.content)) {
      if (part.added) added += countLines(part.value);
      else if (part.removed) removed += countLines(part.value);
    }
    return { added, removed };
  }, [original, edit.content]);

  async function approve() {
    try {
      await fsApi.write(edit.path, edit.content);
      setStatus("applied");
      setExpanded(false);
    } catch {
      setStatus("error");
      return;
    }
    // Standard on every project: an approved edit should actually reach
    // GitHub, not just sit on disk. Best-effort - a plain local folder with
    // no git repo (or no remote) just silently has nothing to push.
    if (settings?.autoCommitAndPush) {
      try {
        await gitApi.stage(edit.path);
        await gitApi.commit(`Vinny: update ${edit.path}`);
        await gitApi.push();
      } catch {
        // Not a git repo, no changes to commit, or push failed - the file
        // write itself already succeeded, so there's nothing more to do here.
      }
    }
  }

  function reject() {
    setStatus("rejected");
    setExpanded(false);
  }

  // Intentionally only on mount - auto-approve decides once per proposed
  // edit. Skipped entirely if this exact edit was already auto-applied in
  // an earlier mount (e.g. a page refresh re-rendering the whole chat
  // history) - otherwise every reload would silently re-write, re-commit,
  // and re-push every edit ever proposed in the conversation.
  useEffect(() => {
    if (autoApprove && !alreadyApplied) {
      markAutoApplied(id);
      void approve();
    }
  }, []);

  const verb = status === "applied" ? "Edited" : status === "rejected" ? "Edit skipped" : "Edit";

  return (
    <div className="action-card">
      <div className="action-card-header">
        <button className="action-card-summary" onClick={() => setExpanded((v) => !v)}>
          <span className="action-card-chevron">{expanded ? "▾" : "▸"}</span>
          <span className="action-card-verb">{verb}</span>
          <span className="action-card-path">{edit.path}</span>
          {stats && (
            <span className="diff-stat">
              <span className="diff-stat-add">+{stats.added}</span>
              <span className="diff-stat-remove">-{stats.removed}</span>
            </span>
          )}
        </button>
        {status === "pending" && (
          <div className="diff-actions">
            <button className="btn btn-primary" onClick={approve}>
              Approve
            </button>
            <button className="btn" onClick={reject}>
              Reject
            </button>
          </div>
        )}
        {status === "error" && (
          <span className="diff-status diff-status-error">Failed to write</span>
        )}
      </div>
      {expanded && original !== null && (
        <div className="diff-editor-wrap">
          <DiffEditor
            original={original}
            modified={edit.content}
            theme="vs-dark"
            options={{
              readOnly: true,
              renderSideBySide: false,
              minimap: { enabled: false },
              fontSize: 12,
            }}
            height="220px"
          />
        </div>
      )}
    </div>
  );
}
