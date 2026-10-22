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
// The path uses `.+` rather than `\S+` - a Windows path routinely has spaces
// in it (e.g. "Documents\Qwen 3\Test\..."), and `\S+` stops at the first one,
// which makes the whole pattern fail to match and the fenced block falls
// through to being shown as raw, unparsed text in the chat.
export const EDIT_BLOCK_PATTERN = /```vinny-edit:(.+)\n([\s\S]*?)\n```/g;

export interface ProposedEdit {
  path: string;
  content: string;
}

export function parseProposedEdits(content: string): ProposedEdit[] {
  const edits: ProposedEdit[] = [];
  for (const match of content.matchAll(EDIT_BLOCK_PATTERN)) {
    const path = match[1].trim();
    if (!path) continue;
    edits.push({ path, content: match[2] });
  }
  return edits;
}

/**
 * The assistant proposes shell commands the same way, with a fenced block:
 *
 *   ```vinny-run
 *   npm test
 *   ```
 *
 * Same rule as edits: the client shows it and requires explicit approval
 * before it actually runs - the model proposing a command never executes it.
 */
export const RUN_BLOCK_PATTERN = /```vinny-run\n([\s\S]*?)\n```/g;

export interface ProposedCommand {
  command: string;
}

export function parseProposedCommands(content: string): ProposedCommand[] {
  const commands: ProposedCommand[] = [];
  for (const match of content.matchAll(RUN_BLOCK_PATTERN)) {
    const command = match[1].trim();
    if (!command) continue;
    commands.push({ command });
  }
  return commands;
}
