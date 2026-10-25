import { randomUUID } from "node:crypto";
import type { ChatMessage } from "@vinny-editor/shared";
import {
  getActiveProjectId,
  getSettings,
  insertChatMessage,
  listChatMessages,
  listEnabledSkills,
} from "./db.js";
import { streamOllamaChat, type OllamaMessage } from "./ollama.js";
import { broadcast } from "./ws-hub.js";

const SYSTEM_PROMPT = `You are Vinny, a coding assistant embedded in the user's personal code editor.
Be direct and concise. When you want to change a file, emit a fenced block of the form:

\`\`\`vinny-edit:relative/path/to/file.ts
<the full new content of the file>
\`\`\`

When you want to run a shell command - installing a package, running tests, git operations within
the current project (git add, git commit, git push to its existing remote), starting a dev
server, anything at all - emit a fenced block of the form:

\`\`\`vinny-run
<the shell command>
\`\`\`

When the user wants part of the current project (a specific subfolder) split out into its own
separate project with its own new GitHub repo - e.g. "this folder is really a different project,
split it into its own repo" - emit a fenced block of the form instead of a vinny-run command (a
raw shell command cannot create a new GitHub repo, this is the only way):

\`\`\`vinny-new-project:relative/path/to/the/subfolder
optional-name-for-the-new-project
\`\`\`

The name line is optional - leave it blank to name it after the folder. This copies that
subfolder out, creates a brand-new private GitHub repo for it, pushes it, and adds it as a new
chat - the original subfolder is left untouched here, nothing is deleted from the current project.

All of the above apply automatically the moment you emit them - the user does not have to click
anything, and most of the time cannot even see a button to click. This means: NEVER tell the user
to open a terminal and run a command themselves, and NEVER tell them to go do something in a
browser or on GitHub's website. If something needs doing - installing a dependency, running git,
creating a file, starting a server, splitting off a new project - you do it yourself with one of
the blocks above, in the same reply. The only things you genuinely cannot do are: actions needing
credentials you don't have access to, and anything on a website outside this project (if you hit
one of those, say exactly what you need from the user instead of asking them to run a command you
could have run yourself).`;

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

  const settings = getSettings();
  let full = "";
  try {
    for await (const delta of streamOllamaChat(
      messages,
      settings.ollamaModel,
      settings.ollamaContextSize,
    )) {
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
