import { env } from "./env.js";

export interface OllamaMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OllamaChatChunk {
  message?: { content?: string };
  done: boolean;
}

// Small local models can fall into repeating the exact same text (a whole
// file's content, in the worst case) over and over instead of finishing a
// reply. repeat_penalty pushes the model away from recently-used tokens so
// it's less likely to loop in the first place; repeat_last_n is how far
// back it looks when deciding what counts as "recent". num_predict is a
// hard ceiling on how many tokens a single reply can generate at all - a
// last-resort backstop so even a loop the chat.ts repetition-detector
// doesn't recognize (not clean vinny-edit blocks, just repeated prose)
// can't run away indefinitely.
const REPEAT_PENALTY = 1.3;
const REPEAT_LAST_N = 256;
const MAX_OUTPUT_TOKENS = 8192;

/** Streams content deltas from Ollama's /api/chat, which yields NDJSON.
 * contextSize is passed as num_ctx - without it, Ollama defaults to a small
 * context window regardless of what the model itself supports, and silently
 * truncates older messages once the conversation (edits embed full file
 * contents, so this grows fast) exceeds it. */
export async function* streamOllamaChat(
  messages: OllamaMessage[],
  model: string,
  contextSize: number,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      options: {
        num_ctx: contextSize,
        repeat_penalty: REPEAT_PENALTY,
        repeat_last_n: REPEAT_LAST_N,
        num_predict: MAX_OUTPUT_TOKENS,
      },
    }),
    signal,
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
