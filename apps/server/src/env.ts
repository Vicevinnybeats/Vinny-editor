import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(4310),
  DATABASE_PATH: z.string().default("./data/vinny-editor.sqlite"),
  WORKSPACE_ROOT: z.string().default("./workspace"),
  AUTH_PASSPHRASE: z.string().default("change-me"),
  SESSION_SECRET: z.string().default("change-me-too"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("qwen3"),
});

export const env = envSchema.parse(process.env);
