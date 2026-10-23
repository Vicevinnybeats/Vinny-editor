import { useState } from "react";
import { projectsApi } from "../api";
import { useConnection } from "../connection";

export function PreviewPanel() {
  const { projects, activeProjectId } = useConnection();
  const [reloadCount, setReloadCount] = useState(0);
  const [busy, setBusy] = useState(false);

  const project = projects.find((p) => p.id === activeProjectId);

  async function setPort() {
    if (!project) return;
    const input = window.prompt(
      "Port this project's dev server runs on (e.g. 3000 for Vite's default, 5173, 8080):",
      project.previewPort ? String(project.previewPort) : "",
    );
    if (input === null) return;
    const trimmed = input.trim();
    const port = trimmed === "" ? null : Number(trimmed);
    if (port !== null && (!Number.isInteger(port) || port <= 0)) {
      window.alert("That doesn't look like a valid port number.");
      return;
    }
    setBusy(true);
    try {
      await projectsApi.setPreviewPort(project.id, port);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't save that port.");
    } finally {
      setBusy(false);
    }
  }

  if (!project) {
    return <div className="preview-panel muted">No chat selected.</div>;
  }

  const previewUrl = project.previewPort
    ? `${window.location.protocol}//${window.location.hostname}:${project.previewPort}`
    : null;

  return (
    <div className="preview-panel">
      <div className="panel-title-row">
        <div className="panel-title">Preview</div>
        <div className="preview-panel-actions">
          <button className="btn btn-small" onClick={setPort} disabled={busy}>
            {project.previewPort ? `Port: ${project.previewPort}` : "Set port"}
          </button>
          {previewUrl && (
            <>
              <button className="btn btn-small" onClick={() => setReloadCount((c) => c + 1)}>
                ↻ Reload
              </button>
              <a className="btn btn-small" href={previewUrl} target="_blank" rel="noreferrer">
                Open ↗
              </a>
            </>
          )}
        </div>
      </div>
      {previewUrl ? (
        <>
          <iframe
            key={reloadCount}
            className="preview-frame"
            src={previewUrl}
            title="Project preview"
          />
          <p className="muted preview-panel-hint">
            Loads directly from {project.previewPort} on this PC - works here and from another
            device on the same network, but not over the ngrok/Cloudflare link unless that dev
            server is also started with a host flag that allows outside connections (e.g.{" "}
            <code>--host</code>).
          </p>
        </>
      ) : (
        <p className="muted">
          Start this project's dev server (e.g. <code>npm run dev</code> in the Terminal), then set
          the port it's running on above to preview it here.
        </p>
      )}
    </div>
  );
}
