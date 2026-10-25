import { z } from "zod";

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  ollamaModel: z.string().default("qwen3"),
  // Ollama defaults to a small context window (often 2048-4096 tokens)
  // unless a request explicitly asks for more. Since every proposed edit
  // embeds a file's full contents in the chat history, that default gets
  // blown past after just a couple of edits, and Ollama silently drops the
  // oldest part of the conversation instead of erroring - which looks
  // exactly like "it forgets everything I said". Larger uses more RAM/VRAM.
  ollamaContextSize: z.number().int().positive().default(32768),
  autoApproveEdits: z.boolean().default(true),
  autoCommitAndPush: z.boolean().default(true),
  githubToken: z.string().default(""),
  // A standard environment applied to every project: these variables are
  // exported into every project's terminal and command runs, and the setup
  // script (if any) runs automatically whenever you switch into a project -
  // the same idea as a cloud environment's Setup script, but per-project
  // here instead of per-container.
  environmentVariables: z.record(z.string(), z.string()).default({}),
  setupScript: z.string().default(""),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
