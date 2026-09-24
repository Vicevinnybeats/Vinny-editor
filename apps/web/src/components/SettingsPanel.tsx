import { useEffect, useState } from "react";
import type { Settings } from "@vinny-editor/shared";
import { authApi, settingsApi } from "../api";

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void settingsApi.get().then(setSettings);
  }, []);

  async function save(next: Settings) {
    setSettings(next);
    await settingsApi.update(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  if (!settings) return <div className="settings-panel muted">Loading settings...</div>;

  return (
    <div className="settings-panel">
      <div className="panel-title">Settings</div>

      <label className="field">
        <span>Theme</span>
        <select
          value={settings.theme}
          onChange={(e) => save({ ...settings, theme: e.target.value as Settings["theme"] })}
        >
          <option value="system">System</option>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>

      <label className="field">
        <span>Ollama model</span>
        <input
          value={settings.ollamaModel}
          onChange={(e) => setSettings({ ...settings, ollamaModel: e.target.value })}
          onBlur={() => save(settings)}
        />
      </label>

      <label className="field">
        <span>Workspace root</span>
        <input
          value={settings.workspaceRoot}
          readOnly
          title="Set via WORKSPACE_ROOT on the server"
        />
      </label>

      {saved && <p className="muted">Saved.</p>}

      <button className="btn" onClick={() => authApi.logout().then(() => window.location.reload())}>
        Lock editor
      </button>
    </div>
  );
}
