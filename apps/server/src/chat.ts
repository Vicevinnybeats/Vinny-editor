import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@vinny-editor/shared";
import { insertChatMessage, listChatMessages } from "./db.js";
import { streamOllamaChat, type OllamaMessage } from "./ollama.js";
import { broadcast } from "./ws-hub.js";

const SYSTEM_PROMPT = `You are Vinny, a coding assistant embedded in the user's personal code editor.
Be direct and concise. When you want to propose changing a file, emit a fenced block of the form:

\`\`\`vinny-edit:relative/path/to/file.ts
<the full new content of the file>
\`\`\`

The user reviews every proposed edit as a diff and must explicitly approve it before anything is
written to disk - never claim you already made a change unless the user approved it.`;

export function sendUserMessage(content: string): {
  userMessage: ChatMessage;
  assistantId: string;
} {
  const now = new Date().toISOString();
  const userMessage: ChatMessage = { id: randomUUID(), role: "user", content, createdAt: now };
  insertChatMessage(userMessage);
  broadcast({ type: "chat:message", message: userMessage });

  const assistantId = randomUUID();
  void runAssistantReply(assistantId);

  return { userMessage, assistantId };
}

async function runAssistantReply(assistantId: string): Promise<void> {
  const history = listChatMessages();
  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content }) satisfies OllamaMessage),
  ];

  let full = "";
  try {
    for await (const delta of streamOllamaChat(messages)) {
      full += delta;
      broadcast({ type: "chat:delta", id: assistantId, delta });
    }
  } catch (err) {
    broadcast({
      type: "chat:error",
      id: assistantId,
      message: err instanceof Error ? err.message : "Ollama request failed",
    });
    return;
  }

  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: full,
    createdAt: new Date().toISOString(),
  };
  insertChatMessage(assistantMessage);
  broadcast({ type: "chat:done", id: assistantId });
}
