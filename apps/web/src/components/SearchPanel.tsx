import { useState, type FormEvent } from "react";
import type { SearchMatch } from "@vinny-editor/shared";
import { searchApi } from "../api";

export function SearchPanel({ onOpenFile }: { onOpenFile: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await searchApi.query(query);
      setMatches(res.matches);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-panel">
      <div className="panel-title">Search</div>
      <form onSubmit={handleSubmit} className="search-form">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search project..."
        />
        <button className="btn btn-primary" type="submit" disabled={loading}>
          Go
        </button>
      </form>
      <ul className="search-results">
        {matches.map((match, i) => (
          <li key={`${match.path}:${match.line}:${i}`}>
            <button className="search-result" onClick={() => onOpenFile(match.path)}>
              <span className="search-result-path">
                {match.path}:{match.line}
              </span>
              <span className="search-result-text">{match.text.trim()}</span>
            </button>
          </li>
        ))}
        {!loading && query && matches.length === 0 && <p className="muted">No matches.</p>}
      </ul>
    </div>
  );
}
