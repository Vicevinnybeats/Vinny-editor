import { useEffect, useState } from "react";
import { tabsApi } from "./api";
import { useConnection } from "./connection";
import { ChangesPanel } from "./components/ChangesPanel";
import { ChatPanel } from "./components/ChatPanel";
import { ConnectorsPanel } from "./components/ConnectorsPanel";
import { EditorPanel } from "./components/EditorPanel";
import { Explorer } from "./components/Explorer";
import { GitPanel } from "./components/GitPanel";
import { ReposPanel } from "./components/ReposPanel";
import { SearchPanel } from "./components/SearchPanel";
import { SessionList } from "./components/SessionList";
import { SettingsPanel } from "./components/SettingsPanel";
import { TerminalPanel } from "./components/TerminalPanel";

type RightTab =
  "editor" | "changes" | "files" | "git" | "repos" | "connectors" | "search" | "settings";
type MobileView = "chats" | "chat" | "panel";

export function App() {
  const { status, tabs, activeProjectId } = useConnection();
  const [activePath, setActivePath] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("editor");
  const [mobileView, setMobileView] = useState<MobileView>("chat");
  const [terminalOpen, setTerminalOpen] = useState(false);

  // A project switch points the server at a different folder, so any
  // previously open tab's path no longer means anything.
  useEffect(() => {
    setActivePath(null);
  }, [activeProjectId]);

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

  function viewChanges() {
    setRightTab("changes");
    setMobileView("panel");
  }

  const rightPanel =
    rightTab === "editor" ? (
      <EditorPanel
        tabs={tabs}
        activePath={activePath}
        onSelectTab={setActivePath}
        onCloseTab={closeTab}
      />
    ) : rightTab === "changes" ? (
      <ChangesPanel />
    ) : rightTab === "files" ? (
      <Explorer onOpenFile={openFile} />
    ) : rightTab === "git" ? (
      <GitPanel />
    ) : rightTab === "repos" ? (
      <ReposPanel />
    ) : rightTab === "connectors" ? (
      <ConnectorsPanel />
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
        {(["chats", "chat", "panel"] as MobileView[]).map((view) => (
          <button
            key={view}
            className={`mobile-tab${mobileView === view ? " mobile-tab-active" : ""}`}
            onClick={() => setMobileView(view)}
          >
            {view === "chats" ? "Chats" : view === "chat" ? "Chat" : "Editor"}
          </button>
        ))}
      </nav>

      <div className="body">
        <aside className={`sidebar${mobileView === "chats" ? " mobile-visible" : ""}`}>
          <SessionList />
        </aside>

        <main className={`main${mobileView === "chat" ? " mobile-visible" : ""}`}>
          <ChatPanel onViewChanges={viewChanges} />
        </main>

        <aside className={`right-dock${mobileView === "panel" ? " mobile-visible" : ""}`}>
          <div className="right-dock-tabs">
            {(
              [
                "editor",
                "changes",
                "files",
                "git",
                "repos",
                "connectors",
                "search",
                "settings",
              ] as RightTab[]
            ).map((tab) => (
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
