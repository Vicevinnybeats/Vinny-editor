import { z } from "zod";

export const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).default("system"),
  ollamaModel: z.string().default("qwen3"),
  autoApproveEdits: z.boolean().default(false),
});

export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = settingsSchema.parse({});
