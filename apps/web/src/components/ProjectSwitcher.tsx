import { useEffect, useRef, useState, type MouseEvent } from "react";
import { projectsApi } from "../api";
import { useConnection } from "../connection";

export function ProjectSwitcher() {
  const { projects, activeProjectId } = useConnection();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = projects.find((p) => p.id === activeProjectId);

  useEffect(() => {
    function handlePointerDown(event: globalThis.MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  async function handleAdd() {
    const path = window
      .prompt("Full path to the project folder on this PC (e.g. C:\\Users\\VInny\\my-project):")
      ?.trim();
    if (!path) return;
    const suggestedName = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const name = window.prompt("Name for this project:", suggestedName)?.trim() || suggestedName;
    try {
      await projectsApi.add(name, path);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't add that folder.");
    }
  }

  async function handleSwitch(id: string) {
    if (id === activeProjectId) {
      setOpen(false);
      return;
    }
    await projectsApi.switchTo(id);
    setOpen(false);
  }

  async function handleRemove(id: string, event: MouseEvent) {
    event.stopPropagation();
    if (!window.confirm("Remove this project from the list? (The folder itself is untouched.)")) {
      return;
    }
    await projectsApi.remove(id);
  }

  return (
    <div className="project-switcher" ref={rootRef}>
      <button
        className="btn btn-small project-switcher-trigger"
        onClick={() => setOpen((v) => !v)}
        title="Switch project folder"
      >
        {active ? active.name : "No project"}
        <span className="project-switcher-chevron">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="project-switcher-menu">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-switcher-item${
                project.id === activeProjectId ? " project-switcher-item-active" : ""
              }`}
              onClick={() => handleSwitch(project.id)}
            >
              <span className="project-switcher-item-text">
                <span className="project-switcher-item-name">{project.name}</span>
                <span className="project-switcher-item-path">{project.path}</span>
              </span>
              {project.id !== activeProjectId && (
                <span
                  className="project-switcher-remove"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => handleRemove(project.id, e)}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button className="project-switcher-add" onClick={handleAdd}>
            + Add project folder
          </button>
        </div>
      )}
    </div>
  );
}
