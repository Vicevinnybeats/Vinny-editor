import { useEffect, useState } from "react";
import type { ProposedCommand } from "@vinny-editor/shared";
import { execApi, type CommandResult } from "../api";
import { useConnection } from "../connection";

export function CommandApproval({ command }: { command: ProposedCommand }) {
  const { settings } = useConnection();
  const autoApprove = settings?.autoApproveEdits ?? false;
  const [status, setStatus] = useState<"pending" | "running" | "done" | "rejected" | "error">(
    "pending",
  );
  const [result, setResult] = useState<CommandResult | null>(null);
  const [expanded, setExpanded] = useState(!autoApprove);

  async function approve() {
    setStatus("running");
    try {
      const res = await execApi.run(command.command);
      setResult(res);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  function reject() {
    setStatus("rejected");
    setExpanded(false);
  }

  // Intentionally only on mount - auto-approve decides once per proposed command.
  useEffect(() => {
    if (autoApprove) void approve();
  }, []);

  const verb =
    status === "done"
      ? `Ran command (exit ${result?.exitCode ?? "?"})`
      : status === "running"
        ? "Running command..."
        : status === "rejected"
          ? "Command skipped"
          : "Run command";

  return (
    <div className="action-card">
      <div className="action-card-header">
        <button className="action-card-summary" onClick={() => setExpanded((v) => !v)}>
          <span className="action-card-chevron">{expanded ? "▾" : "▸"}</span>
          <span className="action-card-verb">{verb}</span>
          <code className="action-card-command">{command.command}</code>
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
        {status === "error" && <span className="diff-status diff-status-error">Failed to run</span>}
      </div>
      {expanded && result && (
        <pre className="action-card-output">
          {result.stdout}
          {result.stderr}
          {result.timedOut && "\n(command timed out)"}
          {!result.stdout && !result.stderr && !result.timedOut && "(no output)"}
        </pre>
      )}
    </div>
  );
}
