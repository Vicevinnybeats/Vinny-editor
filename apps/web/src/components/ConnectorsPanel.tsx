import { useEffect, useState } from "react";
import { connectorsApi, type ConnectorsStatus, type CustomConnectorWithStatus } from "../api";

export function ConnectorsPanel() {
  const [status, setStatus] = useState<ConnectorsStatus | null>(null);
  const [custom, setCustom] = useState<CustomConnectorWithStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setLoading(true);
    Promise.all([connectorsApi.status(), connectorsApi.listCustom()])
      .then(([statusRes, customRes]) => {
        setStatus(statusRes);
        setCustom(customRes.connectors);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function addCustom() {
    const name = window.prompt("Connector name (e.g. My API, Slack webhook):")?.trim();
    if (!name) return;
    const url = window
      .prompt("URL to reach it at (used both to call it and to check it's up):")
      ?.trim();
    if (!url) return;
    const token = window
      .prompt("Bearer token/API key, if it needs one (leave blank otherwise):")
      ?.trim();
    setBusy(true);
    try {
      await connectorsApi.addCustom(name, url, token || undefined);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't add that connector.");
    } finally {
      setBusy(false);
    }
  }

  async function removeCustom(connector: CustomConnectorWithStatus) {
    if (!window.confirm(`Remove the "${connector.name}" connector?`)) return;
    try {
      await connectorsApi.removeCustom(connector.id);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't remove that connector.");
    }
  }

  return (
    <div className="connectors-panel">
      <div className="panel-title-row">
        <div className="panel-title">Connectors</div>
        <div className="connectors-panel-actions">
          <button className="btn btn-small" onClick={addCustom} disabled={busy}>
            + Add connector
          </button>
          <button className="btn btn-small" onClick={refresh} disabled={loading}>
            {loading ? "..." : "Refresh"}
          </button>
        </div>
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
          {custom?.map((connector) => (
            <ConnectorRow
              key={connector.id}
              name={connector.name}
              detail={connector.url}
              connected={connector.connected}
              onRemove={() => removeCustom(connector)}
            />
          ))}
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
  onRemove,
}: {
  name: string;
  detail: string;
  connected: boolean;
  hint?: string;
  onRemove?: () => void;
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
        {onRemove && (
          <button className="session-item-remove" title="Remove this connector" onClick={onRemove}>
            ×
          </button>
        )}
      </div>
      {hint && <p className="muted connector-row-hint">{hint}</p>}
    </div>
  );
}
