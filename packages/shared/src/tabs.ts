import { z } from "zod";

export const tabSchema = z.object({
  path: z.string(),
  buffer: z.string(),
  dirty: z.boolean(),
  updatedAt: z.string(),
});
export type Tab = z.infer<typeof tabSchema>;
