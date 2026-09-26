import { useEffect, useRef, useState } from "react";
import type { FileEntry } from "@vinny-editor/shared";
import { fsApi } from "../api";

interface FileAttachMenuProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FileAttachMenu({ onSelect, onClose }: FileAttachMenuProps) {
  const [entries, setEntries] = useState<FileEntry[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fsApi.tree("").then((res) => setEntries(res.entries));
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [onClose]);

  return (
    <div className="file-attach-menu" ref={rootRef}>
      <div className="file-attach-menu-title">Attach a file</div>
      {entries === null ? (
        <p className="muted">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="muted">Empty workspace.</p>
      ) : (
        <ul className="tree">
          {entries.map((entry) => (
            <AttachNode key={entry.path} entry={entry} depth={0} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachNode({
  entry,
  depth,
  onSelect,
}: {
  entry: FileEntry;
  depth: number;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<FileEntry[] | null>(null);

  async function toggle() {
    if (entry.type === "file") {
      onSelect(entry.path);
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
            <AttachNode key={child.path} entry={child} depth={depth + 1} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
