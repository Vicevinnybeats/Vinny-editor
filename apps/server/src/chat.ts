import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@vinny-editor/shared";
import {
  getActiveProjectId,
  insertChatMessage,
  listChatMessages,
  listEnabledSkills,
} from "./db.js";
import { streamOllamaChat, type OllamaMessage } from "./ollama.js";
import { broadcast } from "./ws-hub.js";

const SYSTEM_PROMPT = `You are Vinny, a coding assistant embedded in the user's personal code editor.
Be direct and concise. When you want to propose changing a file, emit a fenced block of the form:

\`\`\`vinny-edit:relative/path/to/file.ts
<the full new content of the file>
\`\`\`

When you want to propose running a shell command (installing a package, running tests, etc.),
emit a fenced block of the form:

\`\`\`vinny-run
<the shell command>
\`\`\`

The user reviews every proposed edit as a diff, and every proposed command before it runs, and
must explicitly approve each one - never claim you already made a change or ran a command unless
the user approved it.`;

export function sendUserMessage(content: string): {
  userMessage: ChatMessage;
  assistantId: string;
} {
  const projectId = getActiveProjectId();
  const now = new Date().toISOString();
  const userMessage: ChatMessage = { id: randomUUID(), role: "user", content, createdAt: now };
  insertChatMessage(userMessage, projectId);
  broadcast({ type: "chat:message", message: userMessage, projectId });

  const assistantId = randomUUID();
  void runAssistantReply(assistantId, projectId);

  return { userMessage, assistantId };
}

/** Skills are standing instructions the user has added once and that apply
 * to every project, not just the active one - folded into the system
 * prompt on every reply rather than stored per-project. */
function buildSystemPrompt(): string {
  const skills = listEnabledSkills();
  if (skills.length === 0) return SYSTEM_PROMPT;
  const skillsText = skills.map((s) => `### Skill: ${s.name}\n${s.content}`).join("\n\n");
  return `${SYSTEM_PROMPT}\n\nYou also have the following skills enabled for every project - follow them whenever relevant:\n\n${skillsText}`;
}

async function runAssistantReply(assistantId: string, projectId: string | null): Promise<void> {
  const history = listChatMessages(projectId);
  const messages: OllamaMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...history.map((m) => ({ role: m.role, content: m.content }) satisfies OllamaMessage),
  ];

  let full = "";
  try {
    for await (const delta of streamOllamaChat(messages)) {
      full += delta;
      broadcast({ type: "chat:delta", id: assistantId, delta, projectId });
    }
  } catch (err) {
    broadcast({
      type: "chat:error",
      id: assistantId,
      message: err instanceof Error ? err.message : "Ollama request failed",
      projectId,
    });
    return;
  }

  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: full,
    createdAt: new Date().toISOString(),
  };
  insertChatMessage(assistantMessage, projectId);
  broadcast({ type: "chat:done", id: assistantId, projectId });
}
