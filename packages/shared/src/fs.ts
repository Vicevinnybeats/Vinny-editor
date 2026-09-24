import { z } from "zod";

export const fileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory"]),
});
export type FileEntry = z.infer<typeof fileEntrySchema>;
