import { z } from "zod";

export const searchMatchSchema = z.object({
  path: z.string(),
  line: z.number(),
  text: z.string(),
  matchStart: z.number(),
  matchEnd: z.number(),
});
export type SearchMatch = z.infer<typeof searchMatchSchema>;
