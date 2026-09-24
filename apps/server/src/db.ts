import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { defaultSettings, settingsSchema, type Settings } from "@vinny-editor/shared";
import { env } from "./env.js";

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });

export const db = new Database(env.DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    data TEXT NOT NULL
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
