import { useEffect, useState } from "react";
import type { FileEntry } from "@vinny-editor/shared";
import { fsApi } from "../api";
import { useConnection } from "../connection";

interface ExplorerProps {
  onOpenFile: (path: string) => void;
}

export function Explorer({ onOpenFile }: ExplorerProps) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { subscribeFsChange } = useConnection();

  function refresh() {
    return fsApi.tree("").then((res) => setEntries(res.entries));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  useEffect(() => subscribeFsChange(() => void refresh()), [subscribeFsChange]);

  async function handleNewFile() {
    const path = window.prompt("New file path (e.g. src/new.ts):")?.trim();
    if (!path) return;
    await fsApi.write(path, "");
    await refresh();
    onOpenFile(path);
  }

  return (
    <div className="explorer">
      <div className="panel-title-row">
        <div className="panel-title">Explorer</div>
        <button className="btn btn-small btn-icon" onClick={handleNewFile} title="New file">
          +
        </button>
      </div>
      {loading ? (
        <p className="muted">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="muted">Empty workspace.</p>
      ) : (
        <ul className="tree">
          {entries.map((entry) => (
            <TreeNode key={entry.path} entry={entry} depth={0} onOpenFile={onOpenFile} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TreeNode({
  entry,
  depth,
  onOpenFile,
}: {
  entry: FileEntry;
  depth: number;
  onOpenFile: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);
  const { subscribeFsChange } = useConnection();

  useEffect(() => {
    if (entry.type !== "directory") return undefined;
    return subscribeFsChange((changedPath) => {
      if (expanded && changedPath.startsWith(`${entry.path}/`)) {
        void fsApi.tree(entry.path).then((res) => setChildren(res.entries));
      }
    });
  }, [entry, expanded, subscribeFsChange]);

  async function toggle() {
    if (entry.type === "file") {
      onOpenFile(entry.path);
      return;
    }
    if (!expanded && children === null) {
      const res = await fsApi.tree(entry.path);
      setChildren(res.entries);
    }
    setExpanded((v) => !v);
  }

  return (
    <li>
      <button className="tree-row" style={{ paddingLeft: `${depth * 14 + 8}px` }} onClick={toggle}>
        <span className="tree-icon">
          {entry.type === "directory" ? (expanded ? "▾" : "▸") : "•"}
        </span>
        {entry.name}
      </button>
      {entry.type === "directory" && expanded && children && (
        <ul className="tree">
          {children.map((child) => (
            <TreeNode key={child.path} entry={child} depth={depth + 1} onOpenFile={onOpenFile} />
          ))}
        </ul>
      )}
    </li>
  );
}
