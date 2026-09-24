import { env } from "./env.js";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done: boolean;
}

/** Streams content deltas from Ollama's /api/chat, which yields NDJSON. */
export async function* streamOllamaChat(messages: OllamaMessage[]): AsyncGenerator<string> {
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: env.OLLAMA_MODEL, messages, stream: true }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const chunk = JSON.parse(line) as OllamaChatChunk;
      if (chunk.message?.content) yield chunk.message.content;
    }
  }
}
