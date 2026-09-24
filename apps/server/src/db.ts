import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  defaultSettings,
  settingsSchema,
  type Settings,
  type Tab,
  type ChatMessage,
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
`);

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

export function listChatMessages(limit = 200): ChatMessage[] {
  const rows = db
    .prepare("SELECT * FROM chat_messages ORDER BY created_at ASC LIMIT ?")
    .all(limit) as ChatRow[];
  return rows.map(rowToChat);
}

export function insertChatMessage(message: ChatMessage): void {
  db.prepare("INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)").run(
    message.id,
    message.role,
    message.content,
    message.createdAt,
  );
}
