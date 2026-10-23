import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import {
  defaultSettings,
  settingsSchema,
  type Settings,
  type Tab,
  type ChatMessage,
  type Project,
  type Skill,
} from "@vinny-editor/shared";
import { env } from "./env.js";

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

export const db = new Database(env.DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tabs (
    path TEXT PRIMARY KEY,
    buffer TEXT NOT NULL,
    dirty INTEGER NOT NULL DEFAULT 0,
    order_index INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    active_project_id TEXT
  );

  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    source_url TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );
`);

// CREATE TABLE IF NOT EXISTS doesn't add columns to a table that already
// existed from an earlier version of the app - add them defensively.
function addColumnIfMissing(table: string, column: string, ddl: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
addColumnIfMissing("chat_messages", "project_id", "project_id TEXT");
addColumnIfMissing("projects", "github_url", "github_url TEXT");

export function getSettings(): Settings {
  const row = db.prepare("SELECT data FROM settings WHERE id = 1").get() as
    { data: string } | undefined;
  if (!row) return defaultSettings;
  return settingsSchema.parse(JSON.parse(row.data));
}

export function saveSettings(settings: Settings): Settings {
  const parsed = settingsSchema.parse(settings);
  db.prepare(
    `INSERT INTO settings (id, data) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET data = excluded.data`,
  ).run(JSON.stringify(parsed));
  return parsed;
}

interface TabRow {
  path: string;
  buffer: string;
  dirty: number;
  updated_at: string;
}

function rowToTab(row: TabRow): Tab {
  return { path: row.path, buffer: row.buffer, dirty: row.dirty === 1, updatedAt: row.updated_at };
}

export function listTabs(): Tab[] {
  const rows = db.prepare("SELECT * FROM tabs ORDER BY order_index ASC").all() as TabRow[];
  return rows.map(rowToTab);
}

export function openTab(path: string, buffer: string): Tab[] {
  const existing = db.prepare("SELECT path FROM tabs WHERE path = ?").get(path);
  if (!existing) {
    const nextIndex =
      (db.prepare("SELECT COALESCE(MAX(order_index), -1) AS m FROM tabs").get() as { m: number })
        .m + 1;
    db.prepare(
      "INSERT INTO tabs (path, buffer, dirty, order_index, updated_at) VALUES (?, ?, 0, ?, ?)",
    ).run(path, buffer, nextIndex, new Date().toISOString());
  }
  return listTabs();
}

export function closeTab(path: string): Tab[] {
  db.prepare("DELETE FROM tabs WHERE path = ?").run(path);
  return listTabs();
}

export function updateTabBuffer(path: string, buffer: string, dirty: boolean): Tab[] {
  db.prepare("UPDATE tabs SET buffer = ?, dirty = ?, updated_at = ? WHERE path = ?").run(
    buffer,
    dirty ? 1 : 0,
    new Date().toISOString(),
    path,
  );
  return listTabs();
}

interface ChatRow {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

function rowToChat(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    role: row.role as ChatMessage["role"],
    content: row.content,
    createdAt: row.created_at,
  };
}

/** Chat history is scoped per project - switching projects shows that
 * project's own conversation, not a single global thread. */
export function listChatMessages(projectId: string | null, limit = 200): ChatMessage[] {
  const rows = db
    .prepare("SELECT * FROM chat_messages WHERE project_id IS ? ORDER BY created_at ASC LIMIT ?")
    .all(projectId, limit) as ChatRow[];
  return rows.map(rowToChat);
}

export function insertChatMessage(message: ChatMessage, projectId: string | null): void {
  db.prepare(
    "INSERT INTO chat_messages (id, role, content, created_at, project_id) VALUES (?, ?, ?, ?, ?)",
  ).run(message.id, message.role, message.content, message.createdAt, projectId);
}

export function clearTabs(): void {
  db.prepare("DELETE FROM tabs").run();
}

interface ProjectRow {
  id: string;
  name: string;
  path: string;
  created_at: string;
  github_url: string | null;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    path: row.path,
    createdAt: row.created_at,
    githubUrl: row.github_url,
  };
}

export function listProjects(): Project[] {
  const rows = db.prepare("SELECT * FROM projects ORDER BY created_at ASC").all() as ProjectRow[];
  return rows.map(rowToProject);
}

export function addProject(name: string, path: string, githubUrl: string | null = null): Project {
  const project: Project = {
    id: randomUUID(),
    name,
    path,
    createdAt: new Date().toISOString(),
    githubUrl,
  };
  db.prepare(
    "INSERT INTO projects (id, name, path, created_at, github_url) VALUES (?, ?, ?, ?, ?)",
  ).run(project.id, project.name, project.path, project.createdAt, project.githubUrl);
  return project;
}

export function removeProject(id: string): void {
  db.prepare("DELETE FROM projects WHERE id = ?").run(id);
}

export function getActiveProjectId(): string | null {
  const row = db.prepare("SELECT active_project_id FROM app_state WHERE id = 1").get() as
    { active_project_id: string | null } | undefined;
  return row?.active_project_id ?? null;
}

export function setActiveProjectId(id: string | null): void {
  db.prepare(
    `INSERT INTO app_state (id, active_project_id) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET active_project_id = excluded.active_project_id`,
  ).run(id);
}

interface SkillRow {
  id: string;
  name: string;
  content: string;
  source_url: string | null;
  enabled: number;
  created_at: string;
}

function rowToSkill(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    content: row.content,
    sourceUrl: row.source_url,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
  };
}

/** Skills are global standing instructions, not scoped to a project - every
 * chat, in every project, gets whichever ones are enabled folded into its
 * system prompt. */
export function listSkills(): Skill[] {
  const rows = db.prepare("SELECT * FROM skills ORDER BY created_at ASC").all() as SkillRow[];
  return rows.map(rowToSkill);
}

export function listEnabledSkills(): Skill[] {
  return listSkills().filter((s) => s.enabled);
}

export function addSkill(name: string, content: string, sourceUrl: string | null): Skill {
  const skill: Skill = {
    id: randomUUID(),
    name,
    content,
    sourceUrl,
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    "INSERT INTO skills (id, name, content, source_url, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)",
  ).run(skill.id, skill.name, skill.content, skill.sourceUrl, skill.createdAt);
  return skill;
}

export function setSkillEnabled(id: string, enabled: boolean): void {
  db.prepare("UPDATE skills SET enabled = ? WHERE id = ?").run(enabled ? 1 : 0, id);
}

export function removeSkill(id: string): void {
  db.prepare("DELETE FROM skills WHERE id = ?").run(id);
}
