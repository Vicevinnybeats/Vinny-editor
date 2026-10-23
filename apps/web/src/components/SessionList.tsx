import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { GithubRepo } from "../api";
import { githubApi, projectsApi } from "../api";
import { useConnection } from "../connection";

export function SessionList() {
  const { projects, activeProjectId, settings } = useConnection();
  const [menuOpen, setMenuOpen] = useState(false);
  const [githubOpen, setGithubOpen] = useState(false);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [reposError, setReposError] = useState<string | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const githubRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
      if (githubRef.current && !githubRef.current.contains(event.target as Node)) {
        setGithubOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function loadRepos() {
    setReposLoading(true);
    setReposError(null);
    try {
      const res = await githubApi.listRepos();
      setRepos(res.repos);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : "Couldn't load your repos.");
      setRepos(null);
    } finally {
      setReposLoading(false);
    }
  }

  async function addLocal() {
    setMenuOpen(false);
    const path = window
      .prompt(
        "Full path to the project folder on this PC (e.g. C:\\Users\\VInny\\my-project). " +
          "This also creates a private GitHub repo for it and pushes it there:",
      )
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

  function openGithubPicker() {
    setMenuOpen(false);
    setGithubOpen(true);
    void loadRepos();
  }

  async function cloneRepo(repo: GithubRepo) {
    setGithubOpen(false);
    setBusy(true);
    try {
      await projectsApi.clone(repo.htmlUrl, settings?.githubToken || undefined, undefined);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't clone that repo.");
    } finally {
      setBusy(false);
    }
  }

  async function addFromGithubUrl() {
    setGithubOpen(false);
    const url = window
      .prompt(
        "Repo URL (https://github.com/owner/repo) - for one not in the list above, e.g. someone else's public repo:",
      )
      ?.trim();
    if (!url) return;
    const token = window
      .prompt(
        "Personal access token, only if this is a private repo you don't own (leave blank otherwise). Used once to clone, never saved:",
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
      await projectsApi.clone(url, token || settings?.githubToken || undefined, name);
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
    const isActive = id === activeProjectId;
    const message = isActive
      ? "Delete this chat? You'll be switched to another one. (The folder itself is untouched.)"
      : "Delete this chat? (The folder itself is untouched.)";
    if (!window.confirm(message)) return;
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
              <button onClick={openGithubPicker}>From GitHub</button>
            </div>
          )}
          {githubOpen && (
            <div className="session-add-menu github-picker" ref={githubRef}>
              <div className="github-picker-header">
                <span>Your repos</span>
                <button
                  className="btn btn-small btn-icon"
                  onClick={loadRepos}
                  disabled={reposLoading}
                  title="Refresh"
                >
                  {reposLoading ? "..." : "↻"}
                </button>
              </div>
              {reposError && (
                <div className="github-picker-error">
                  {reposError}
                  <button className="github-picker-url-fallback" onClick={addFromGithubUrl}>
                    Paste a URL instead
                  </button>
                </div>
              )}
              {!reposError && repos && repos.length === 0 && (
                <p className="muted session-list-empty">No repos found for that token.</p>
              )}
              {!reposError && repos && repos.length > 0 && (
                <ul className="github-picker-list">
                  {repos.map((repo) => (
                    <li key={repo.fullName}>
                      <button onClick={() => cloneRepo(repo)}>
                        {repo.fullName}
                        {repo.private && <span className="github-picker-private">private</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!reposError && (
                <button className="github-picker-url-fallback" onClick={addFromGithubUrl}>
                  Paste a URL instead
                </button>
              )}
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
                <span
                  className="session-item-remove"
                  role="button"
                  tabIndex={0}
                  title="Delete this chat"
                  onClick={(e) => remove(project.id, e)}
                >
                  ×
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
