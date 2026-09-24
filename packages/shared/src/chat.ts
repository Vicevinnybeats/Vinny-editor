import { z } from "zod";

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  createdAt: z.string(),
  pending: z.boolean().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

/**
 * The assistant proposes file edits with a fenced block:
 *
 *   ```vinny-edit:path/to/file.ts
 *   <full new file content>
 *   ```
 *
 * The client parses these out of assistant messages and renders a diff
 * against the current file content, requiring explicit approval before the
 * write actually happens - nothing the model says touches disk on its own.
 */
export const EDIT_BLOCK_PATTERN = /```vinny-edit:(\S+)\n([\s\S]*?)\n```/g;

export interface ProposedEdit {
  path: string;
  content: string;
}

export function parseProposedEdits(content: string): ProposedEdit[] {
  const edits: ProposedEdit[] = [];
  for (const match of content.matchAll(EDIT_BLOCK_PATTERN)) {
    edits.push({ path: match[1], content: match[2] });
  }
  return edits;
}
