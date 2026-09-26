import { DiffEditor } from "@monaco-editor/react";
import { diffLines } from "diff";
import { useEffect, useMemo, useState } from "react";
import type { ProposedEdit } from "@vinny-editor/shared";
import { fsApi } from "../api";

function countLines(text: string): number {
  if (text === "") return 0;
  return text.endsWith("\n") ? text.split("\n").length - 1 : text.split("\n").length;
}

export function DiffApproval({ edit }: { edit: ProposedEdit }) {
  const [original, setOriginal] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "applied" | "rejected" | "error">("pending");
  const [expanded, setExpanded] = useState(true);

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
    }
  }

  function reject() {
    setStatus("rejected");
    setExpanded(false);
  }

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
