import { useState } from "react";
import { tabsApi } from "./api";
import { useConnection } from "./connection";
import { ChatPanel } from "./components/ChatPanel";
import { EditorPanel } from "./components/EditorPanel";
import { Explorer } from "./components/Explorer";
import { GitPanel } from "./components/GitPanel";
import { SearchPanel } from "./components/SearchPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { TerminalPanel } from "./components/TerminalPanel";

type RightTab = "editor" | "git" | "search" | "settings";
type MobileView = "files" | "chat" | "panel";

export function App() {
  const { status, tabs } = useConnection();
  const [activePath, setActivePath] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("editor");
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [terminalOpen, setTerminalOpen] = useState(false);

  async function openFile(path: string) {
    await tabsApi.open(path);
    setActivePath(path);
    setRightTab("editor");
    setMobileView("panel");
  }

  async function closeTab(path: string) {
    await tabsApi.close(path);
    if (activePath === path) {
      const remaining = tabs.filter((t) => t.path !== path);
      setActivePath(remaining[0]?.path ?? null);
    }
  }

  const rightPanel =
    rightTab === "editor" ? (
      <EditorPanel
        tabs={tabs}
        activePath={activePath}
        onSelectTab={setActivePath}
        onCloseTab={closeTab}
      />
    ) : rightTab === "git" ? (
      <GitPanel />
    ) : rightTab === "search" ? (
      <SearchPanel onOpenFile={openFile} />
    ) : (
      <SettingsPanel />
    );

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">V</span>
          <span className="brand-text">Vinny Editor</span>
        </div>
        <div className="topbar-actions">
          <span className={`status-pill status-${status}`}>{status}</span>
          <button
            className={`btn btn-small${terminalOpen ? " btn-active" : ""}`}
            onClick={() => setTerminalOpen((v) => !v)}
          >
            Terminal
          </button>
        </div>
      </header>

      <nav className="mobile-tabs">
        {(["files", "chat", "panel"] as MobileView[]).map((view) => (
          <button
            key={view}
            className={`mobile-tab${mobileView === view ? " mobile-tab-active" : ""}`}
            onClick={() => setMobileView(view)}
          >
            {view === "files" ? "Files" : view === "chat" ? "Chat" : "Editor"}
          </button>
        ))}
      </nav>

      <div className="body">
        <aside className={`sidebar${mobileView === "files" ? " mobile-visible" : ""}`}>
          <Explorer onOpenFile={openFile} />
        </aside>

        <main className={`main${mobileView === "chat" ? " mobile-visible" : ""}`}>
          <ChatPanel />
        </main>

        <aside className={`right-dock${mobileView === "panel" ? " mobile-visible" : ""}`}>
          <div className="right-dock-tabs">
            {(["editor", "git", "search", "settings"] as RightTab[]).map((tab) => (
              <button
                key={tab}
                className={`dock-tab${rightTab === tab ? " dock-tab-active" : ""}`}
                onClick={() => setRightTab(tab)}
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
          <div className="right-dock-body">{rightPanel}</div>
        </aside>
      </div>

      {terminalOpen && (
        <div className="terminal-drawer">
          <div className="terminal-drawer-header">
            <span>Terminal</span>
            <button className="btn btn-small" onClick={() => setTerminalOpen(false)}>
              Close
            </button>
          </div>
          <TerminalPanel />
        </div>
      )}
    </div>
  );
}
