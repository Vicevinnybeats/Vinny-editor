import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: z.string(),
  githubUrl: z.string().nullable(),
  // The port this project's own dev server runs on (e.g. 3000, 5173) -
  // set so the Preview tab knows what to proxy to. Null until configured.
  previewPort: z.number().int().positive().nullable(),
});
export type Project = z.infer<typeof projectSchema>;
