import { z } from "zod";

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;
