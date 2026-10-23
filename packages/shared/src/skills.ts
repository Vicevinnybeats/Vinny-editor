import { z } from "zod";

export const skillSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  sourceUrl: z.string().nullable(),
  enabled: z.boolean(),
  createdAt: z.string(),
});
export type Skill = z.infer<typeof skillSchema>;
