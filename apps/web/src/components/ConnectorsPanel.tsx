import { useEffect, useState } from "react";
import { connectorsApi, type ConnectorsStatus } from "../api";

export function ConnectorsPanel() {
  const [status, setStatus] = useState<ConnectorsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    connectorsApi
      .status()
      .then(setStatus)
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  return (
    <div className="connectors-panel">
      <div className="panel-title-row">
        <div className="panel-title">Connectors</div>
        <button className="btn btn-small" onClick={refresh} disabled={loading}>
          {loading ? "..." : "Refresh"}
        </button>
      </div>
      {status && (
        <div className="connectors-list">
          <ConnectorRow
            name="Ollama"
            detail={`${status.ollama.model} · ${status.ollama.baseUrl}`}
            connected={status.ollama.connected}
            hint={status.ollama.connected ? undefined : "Run `ollama serve` on this PC."}
          />
          <ConnectorRow
            name="GitHub"
            detail={status.github.hasToken ? "Personal access token saved" : "No token saved"}
            connected={status.github.connected}
            hint={status.github.connected ? undefined : "Add a token in the Settings tab."}
          />
        </div>
      )}
    </div>
  );
}

function ConnectorRow({
  name,
  detail,
  connected,
  hint,
}: {
  name: string;
  detail: string;
  connected: boolean;
  hint?: string;
}) {
  return (
    <div className="connector-row">
      <div className="connector-row-main">
        <span className={`connector-dot${connected ? " connector-dot-connected" : ""}`} />
        <div className="connector-row-text">
          <span className="connector-row-name">{name}</span>
          <span className="connector-row-detail muted">{detail}</span>
        </div>
        <span className={`connector-status${connected ? " connector-status-connected" : ""}`}>
          {connected ? "Connected" : "Not connected"}
        </span>
      </div>
      {hint && <p className="muted connector-row-hint">{hint}</p>}
    </div>
  );
}
