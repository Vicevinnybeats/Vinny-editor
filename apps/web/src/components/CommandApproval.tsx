import { useEffect, useState } from "react";
import type { ProposedCommand } from "@vinny-editor/shared";
import { execApi, type CommandResult } from "../api";
import { markAutoApplied, wasAlreadyAutoApplied } from "../autoApproveGuard";
import { useConnection } from "../connection";

export function CommandApproval({ id, command }: { id: string; command: ProposedCommand }) {
  const { settings } = useConnection();
  const autoApprove = settings?.autoApproveEdits ?? false;
  const alreadyApplied = wasAlreadyAutoApplied(id);
  const [status, setStatus] = useState<"pending" | "running" | "done" | "rejected" | "error">(
    alreadyApplied ? "done" : "pending",
  );
  const [result, setResult] = useState<CommandResult | null>(null);
  const [expanded, setExpanded] = useState(!autoApprove && !alreadyApplied);

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

  // Intentionally only on mount - auto-approve decides once per proposed
  // command. Skipped if this exact command was already auto-run in an
  // earlier mount (e.g. a page refresh), so a reload never re-runs a shell
  // command like "npm install" or "npm start" a second (or fifteenth) time.
  useEffect(() => {
    if (autoApprove && !alreadyApplied) {
      markAutoApplied(id);
      void approve();
    }
  }, []);

  const verb =
    status === "done"
      ? result
        ? `Ran command (exit ${result.exitCode ?? "?"})`
        : "Ran command (output not kept after reload)"
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
      {expanded && status === "done" && (
        <pre className="action-card-output">
          {result ? (
            <>
              {result.stdout}
              {result.stderr}
              {result.timedOut && "\n(command timed out)"}
              {!result.stdout && !result.stderr && !result.timedOut && "(no output)"}
            </>
          ) : (
            "(this ran in an earlier session - its output wasn't saved, only that it ran. " +
            "Check the project's Terminal or Preview tab to see current results.)"
          )}
        </pre>
      )}
    </div>
  );
}
