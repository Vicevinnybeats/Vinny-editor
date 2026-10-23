import { useEffect, useState } from "react";
import type { Skill } from "@vinny-editor/shared";
import { skillsApi } from "../api";

export function SkillsPanel() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  function refresh() {
    setLoading(true);
    setError(null);
    skillsApi
      .list()
      .then((res) => setSkills(res.skills))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Couldn't load skills.");
        setSkills(null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function addFromUrl() {
    const url = window
      .prompt(
        "GitHub repo or SKILL.md URL (e.g. https://github.com/owner/some-skill, " +
          "or a repo with several skills - you'll be asked which folder next):",
      )
      ?.trim();
    if (!url) return;
    const path = window
      .prompt(
        "If that repo holds more than one skill, the folder name to use (leave blank for the repo root):",
      )
      ?.trim();
    setBusy(true);
    try {
      await skillsApi.fetchFromUrl(url, path || undefined, undefined);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't fetch that skill.");
    } finally {
      setBusy(false);
    }
  }

  async function addPasted() {
    const name = window.prompt("Name for this skill:")?.trim();
    if (!name) return;
    const content = window.prompt("Paste the skill's instructions (Markdown is fine):")?.trim();
    if (!content) return;
    setBusy(true);
    try {
      await skillsApi.add(name, content);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't add that skill.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(skill: Skill) {
    try {
      await skillsApi.setEnabled(skill.id, !skill.enabled);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't update that skill.");
    }
  }

  async function remove(skill: Skill) {
    if (!window.confirm(`Remove the "${skill.name}" skill?`)) return;
    try {
      await skillsApi.remove(skill.id);
      refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't remove that skill.");
    }
  }

  return (
    <div className="skills-panel">
      <div className="panel-title-row">
        <div className="panel-title">Skills</div>
        <div className="skills-panel-actions">
          <button className="btn btn-small" onClick={addFromUrl} disabled={busy}>
            + From URL
          </button>
          <button className="btn btn-small" onClick={addPasted} disabled={busy}>
            + Paste
          </button>
        </div>
      </div>
      <p className="muted skills-panel-hint">
        Enabled skills apply to every project automatically - they're folded into every chat's
        instructions, not just this one.
      </p>
      {error && <p className="muted skills-panel-error">{error}</p>}
      {!error && loading && !skills && <p className="muted">Loading...</p>}
      {!error && skills && skills.length === 0 && (
        <p className="muted">No skills yet - add one from a URL or paste it in.</p>
      )}
      {!error && skills && skills.length > 0 && (
        <ul className="skills-list">
          {skills.map((skill) => (
            <li key={skill.id} className="skills-list-row">
              <label className="skills-list-toggle">
                <input type="checkbox" checked={skill.enabled} onChange={() => toggle(skill)} />
                <span className="skills-list-text">
                  <span className="skills-list-name">{skill.name}</span>
                  {skill.sourceUrl && <span className="skills-list-source">{skill.sourceUrl}</span>}
                </span>
              </label>
              <button
                className="session-item-remove"
                title="Remove this skill"
                onClick={() => remove(skill)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
