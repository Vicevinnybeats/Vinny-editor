import { useEffect, useRef, useState, type MouseEvent } from "react";
import { projectsApi } from "../api";
import { useConnection } from "../connection";

export function SessionList() {
  const { projects, activeProjectId } = useConnection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function addLocal() {
    setMenuOpen(false);
    const path = window
      .prompt("Full path to the project folder on this PC (e.g. C:\\Users\\VInny\\my-project):")
      ?.trim();
    if (!path) return;
    const suggestedName = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const name = window.prompt("Name for this chat:", suggestedName)?.trim() || suggestedName;
    setBusy(true);
    try {
      await projectsApi.add(name, path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't add that folder.");
    } finally {
      setBusy(false);
    }
  }

  async function addFromGithub() {
    setMenuOpen(false);
    const url = window.prompt("GitHub repo URL (https://github.com/owner/repo):")?.trim();
    if (!url) return;
    const token = window
      .prompt(
        "Personal access token, only if this is a private repo (leave blank for public repos). It's used once to clone and is never saved:",
      )
      ?.trim();
    const defaultName = url
      .replace(/\.git$/, "")
      .split("/")
      .filter(Boolean)
      .pop();
    const name = window.prompt("Name for this chat:", defaultName)?.trim() || undefined;
    setBusy(true);
    try {
      await projectsApi.clone(url, token || undefined, name);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't clone that repo.");
    } finally {
      setBusy(false);
    }
  }

  async function switchTo(id: string) {
    if (id === activeProjectId) return;
    await projectsApi.switchTo(id);
  }

  async function remove(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Remove this chat? (The folder itself is untouched.)")) return;
    await projectsApi.remove(id);
  }

  return (
    <div className="session-list">
      <div className="panel-title-row">
        <div className="panel-title">Chats</div>
        <div className="session-add" ref={menuRef}>
          <button
            className="btn btn-small btn-icon"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy}
            title="New chat"
          >
            +
          </button>
          {menuOpen && (
            <div className="session-add-menu">
              <button onClick={addLocal}>Local folder</button>
              <button onClick={addFromGithub}>From GitHub</button>
            </div>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <p className="muted session-list-empty">No chats yet - tap + to start one.</p>
      ) : (
        <ul className="session-items">
          {projects.map((project) => (
            <li key={project.id}>
              <button
                className={`session-item${project.id === activeProjectId ? " session-item-active" : ""}`}
                onClick={() => switchTo(project.id)}
              >
                <span className="session-item-text">
                  <span className="session-item-name">{project.name}</span>
                  <span className="session-item-path">{project.githubUrl ?? project.path}</span>
                </span>
                {project.id !== activeProjectId && (
                  <span
                    className="session-item-remove"
                    role="button"
                    tabIndex={0}
                    onClick={(e) => remove(project.id, e)}
                  >
                    ×
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
