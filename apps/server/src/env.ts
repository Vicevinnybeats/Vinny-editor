import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

// npm's workspace scripts (`npm run server` -> `--workspace @vinny-editor/server`)
// run with cwd set to apps/server, not the repo root - so a plain `dotenv.config()`
// silently misses the root .env. Resolve it from this file's own location instead,
// which is stable whether we're run via tsx from src/ or node from dist/ (both sit
// three directories below the repo root).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

dotenv.config({ path: resolve(REPO_ROOT, ".env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  SERVER_PORT: z.coerce.number().int().positive().default(4310),
  DATABASE_PATH: z.string().default("./data/vinny-editor.sqlite"),
  WORKSPACE_ROOT: z.string().default("./workspace"),
  AUTH_PASSPHRASE: z.string().default("change-me"),
  SESSION_SECRET: z.string().default("change-me-too"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen3"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  // Resolve relative paths against the repo root too, for the same reason -
  // an absolute value the user provides passes through unchanged.
  DATABASE_PATH: resolve(REPO_ROOT, parsed.DATABASE_PATH),
  WORKSPACE_ROOT: resolve(REPO_ROOT, parsed.WORKSPACE_ROOT),
};
