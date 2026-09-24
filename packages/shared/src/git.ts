import { z } from "zod";

export const gitStatusSchema = z.object({
  isRepo: z.boolean(),
  branch: z.string().nullable(),
  ahead: z.number(),
  behind: z.number(),
  staged: z.array(z.string()),
  unstaged: z.array(z.string()),
  untracked: z.array(z.string()),
});
export type GitStatus = z.infer<typeof gitStatusSchema>;
