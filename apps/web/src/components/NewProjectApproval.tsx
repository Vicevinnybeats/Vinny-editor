import { useEffect, useState } from "react";
import type { ProposedNewProject } from "@vinny-editor/shared";
import { projectsApi } from "../api";
import { markAutoApplied, wasAlreadyAutoApplied } from "../autoApproveGuard";
import { useConnection } from "../connection";

export function NewProjectApproval({ id, item }: { id: string; item: ProposedNewProject }) {
  const { settings } = useConnection();
  const autoApprove = settings?.autoApproveEdits ?? false;
  const alreadyApplied = wasAlreadyAutoApplied(id);
  const [status, setStatus] = useState<"pending" | "running" | "done" | "rejected" | "error">(
    alreadyApplied ? "done" : "pending",
  );
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setStatus("running");
    try {
      await projectsApi.split(item.sourcePath, item.name);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't split that folder off.");
      setStatus("error");
    }
  }

  function reject() {
    setStatus("rejected");
  }

  // Intentionally only on mount, same rule as edits/commands - skipped if
  // this exact split already ran in an earlier mount (e.g. a page refresh),
  // since re-running it would create a second duplicate GitHub repo.
  useEffect(() => {
    if (autoApprove && !alreadyApplied) {
      markAutoApplied(id);
      void approve();
    }
  }, []);

  const verb =
    status === "done"
      ? "Split into new project"
      : status === "running"
        ? "Splitting into new project..."
        : status === "rejected"
          ? "Split skipped"
          : "Split into new project";

  return (
    <div className="action-card">
      <div className="action-card-header">
        <div className="action-card-summary">
          <span className="action-card-verb">{verb}</span>
          <code className="action-card-command">{item.sourcePath}</code>
        </div>
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
          <span className="diff-status diff-status-error">{error ?? "Failed"}</span>
        )}
      </div>
    </div>
  );
}
