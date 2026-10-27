import { randomUUID } from "node:crypto";
import {
  parseProposedCommands,
  parseProposedEdits,
  parseProposedNewProjects,
  type ChatMessage,
} from "@vinny-editor/shared";
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
could have run yourself).

CRITICAL: a checklist, a status report, or a "here's what's still needed" summary is NEVER a
substitute for doing the work. If the user asked you to build, fix, finish, or wire something up,
your reply must contain the actual vinny-edit / vinny-run / vinny-new-project blocks that do it -
not a description of what those blocks would contain. Do not end a reply with "let me know when
you're ready" or "run npm run dev and test it" - you can run npm run dev yourself with a vinny-run
block, and you check your own work by reading the files back, not by asking the user to test it in
a browser and report back.

BAD (never do this):
"### What's still needed:
1. Complete VoiceInput.tsx speech recognition
2. Wire the game flow in page.tsx
Run npm run dev when ready and let me know!"

GOOD (always do this instead):
"Finishing VoiceInput.tsx and wiring the game flow now.
\`\`\`vinny-edit:components/VoiceInput.tsx
<the full real file content>
\`\`\`
\`\`\`vinny-edit:app/play/[chapterId]/page.tsx
<the full real file content>
\`\`\`
\`\`\`vinny-run
npm run dev
\`\`\`"

If a task is too large for one reply, say so and then do as much of it as you can with real blocks
in this same reply anyway - a partial real edit is useful, a checklist is not.`;

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

/** True once the reply contains at least one block that actually does
 * something (edit/run/split) rather than just describing what's left to do. */
function hasActionBlock(content: string): boolean {
  return (
    parseProposedEdits(content).length > 0 ||
    parseProposedCommands(content).length > 0 ||
    parseProposedNewProjects(content).length > 0
  );
}

const NUDGE_MESSAGE =
  "You just described what still needs doing instead of doing it. Don't explain, don't ask me " +
  "to run anything, and don't summarize next steps - actually write the real vinny-edit / " +
  "vinny-run / vinny-new-project blocks right now for the items you listed, in this same reply.";

async function runAssistantReply(assistantId: string, projectId: string | null): Promise<void> {
  const history = listChatMessages(projectId);
  const baseMessages: OllamaMessage[] = [
    { role: "system", content: buildSystemPrompt() },
    ...history.map((m) => ({ role: m.role, content: m.content }) satisfies OllamaMessage),
  ];

  const settings = getSettings();

  // Small local models often reply with a status report/checklist instead of
  // actually emitting edits. Rather than surface that to the user and make
  // them nag Vinny to "just do it", retry once server-side with a nudge
  // appended to the prompt - invisibly, under the same streamed bubble - and
  // only persist/finalize once we have a reply that actually does something
  // (or we've already given it one extra try).
  let messages = baseMessages;
  let full = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let attemptFull = "";
    try {
      for await (const delta of streamOllamaChat(
        messages,
        settings.ollamaModel,
        settings.ollamaContextSize,
      )) {
        attemptFull += delta;
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

    full += attemptFull;
    if (attempt === 1 || hasActionBlock(attemptFull)) break;

    messages = [
      ...baseMessages,
      { role: "assistant", content: attemptFull },
      { role: "user", content: NUDGE_MESSAGE },
    ];
    const sep = "\n\n";
    full += sep;
    broadcast({ type: "chat:delta", id: assistantId, delta: sep, projectId });
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
