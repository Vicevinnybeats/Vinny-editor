import Editor from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import type { Tab } from "@vinny-editor/shared";
import { fsApi, tabsApi } from "../api";
import { useConnection } from "../connection";

interface EditorPanelProps {
  tabs: Tab[];
  activePath: string | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
}

const SAVE_DEBOUNCE_MS = 600;

export function EditorPanel({ tabs, activePath, onSelectTab, onCloseTab }: EditorPanelProps) {
  const activeTab = tabs.find((t) => t.path === activePath) ?? null;
  const { subscribeFsChange } = useConnection();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!activeTab) return undefined;
    return subscribeFsChange((path) => {
      if (path !== activeTab.path || activeTab.dirty) return;
      void fsApi.file(path).then((res) => tabsApi.buffer(path, res.content, false));
    });
  }, [activeTab, subscribeFsChange]);

  function handleChange(value: string | undefined) {
    if (!activeTab || value === undefined) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void tabsApi.buffer(activeTab.path, value, true).then(() => {
        void fsApi
          .write(activeTab.path, value)
          .then(() => tabsApi.buffer(activeTab.path, value, false));
      });
    }, SAVE_DEBOUNCE_MS);
  }

  return (
    <div className="editor-panel">
      <div className="tab-bar">
        {tabs.length === 0 && <span className="muted tab-bar-empty">No files open</span>}
        {tabs.map((tab) => (
          <div key={tab.path} className={`tab${tab.path === activePath ? " tab-active" : ""}`}>
            <button className="tab-label" onClick={() => onSelectTab(tab.path)}>
              {tab.dirty && <span className="dirty-dot" />}
              {tab.path.split("/").pop()}
            </button>
            <button
              className="tab-close"
              onClick={() => onCloseTab(tab.path)}
              aria-label={`Close ${tab.path}`}
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="editor-surface">
        {activeTab ? (
          <Editor
            key={activeTab.path}
            path={activeTab.path}
            defaultValue={activeTab.buffer}
            theme="vs-dark"
            language={languageFromPath(activeTab.path)}
            onChange={handleChange}
            options={{ minimap: { enabled: false }, fontSize: 13, automaticLayout: true }}
          />
        ) : (
          <div className="editor-placeholder muted">Select a file to start editing.</div>
        )}
      </div>
    </div>
  );
}

function languageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    html: "html",
    md: "markdown",
    py: "python",
    go: "go",
    rs: "rust",
    yml: "yaml",
    yaml: "yaml",
    sh: "shell",
  };
  return map[ext ?? ""] ?? "plaintext";
}
