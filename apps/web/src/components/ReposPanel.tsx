import { useEffect, useState } from "react";
import { githubApi, projectsApi, type GithubRepo } from "../api";
import { useConnection } from "../connection";

export function ReposPanel() {
  const { settings } = useConnection();
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cloningFullName, setCloningFullName] = useState<string | null>(null);

  function refresh() {
    setLoading(true);
    setError(null);
    githubApi
      .listRepos()
      .then((res) => setRepos(res.repos))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't load your repos.");
        setRepos(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function clone(repo: GithubRepo) {
    setCloningFullName(repo.fullName);
    try {
      await projectsApi.clone(repo.htmlUrl, settings?.githubToken || undefined, undefined);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't clone that repo.");
    } finally {
      setCloningFullName(null);
    }
  }

  return (
    <div className="repos-panel">
      <div className="panel-title-row">
        <div className="panel-title">Your repos</div>
        <button className="btn btn-small" onClick={refresh} disabled={loading} title="Refresh">
          {loading ? "..." : "↻ Refresh"}
        </button>
      </div>
      {error && <p className="muted repos-panel-error">{error}</p>}
      {!error && repos && repos.length === 0 && (
        <p className="muted">No repos found for that token.</p>
      )}
      {!error && repos && repos.length > 0 && (
        <ul className="repos-list">
          {repos.map((repo) => (
            <li key={repo.fullName} className="repos-list-row">
              <span className="repos-list-text">
                <span className="repos-list-name">{repo.fullName}</span>
                {repo.private && <span className="github-picker-private">private</span>}
              </span>
              <button
                className="btn btn-small"
                onClick={() => clone(repo)}
                disabled={cloningFullName === repo.fullName}
              >
                {cloningFullName === repo.fullName ? "Cloning..." : "Clone"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
