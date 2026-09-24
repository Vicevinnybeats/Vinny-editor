import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useState } from "react";
import type { ProposedEdit } from "@vinny-editor/shared";
import { fsApi } from "../api";

export function DiffApproval({ edit }: { edit: ProposedEdit }) {
  const [original, setOriginal] = useState<string | null>(null);
  const [status, setStatus] = useState<"pending" | "applied" | "rejected" | "error">("pending");

  useEffect(() => {
    fsApi
      .file(edit.path)
      .then((res) => setOriginal(res.content))
      .catch(() => setOriginal(""));
  }, [edit.path]);

  async function approve() {
    try {
      await fsApi.write(edit.path, edit.content);
      setStatus("applied");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="diff-card">
      <div className="diff-card-header">
        <span>{edit.path}</span>
        {status === "pending" && (
          <div className="diff-actions">
            <button className="btn btn-primary" onClick={approve}>
              Approve
            </button>
            <button className="btn" onClick={() => setStatus("rejected")}>
              Reject
            </button>
          </div>
        )}
        {status === "applied" && <span className="diff-status diff-status-ok">Applied</span>}
        {status === "rejected" && <span className="diff-status">Rejected</span>}
        {status === "error" && (
          <span className="diff-status diff-status-error">Failed to write</span>
        )}
      </div>
      {original !== null && (
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
