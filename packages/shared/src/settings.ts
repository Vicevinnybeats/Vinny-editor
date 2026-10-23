import { z } from "zod";

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  ollamaModel: z.string().default("qwen3"),
  autoApproveEdits: z.boolean().default(false),
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
