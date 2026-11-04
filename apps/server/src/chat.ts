import { randomUUID } from "node:crypto";
import {
  COMMAND_RESULT_PREFIX,
  EDIT_BLOCK_PATTERN,
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
in this same reply anyway - a partial real edit is useful, a checklist is not.

Also: never emit more than one edit block for the same file path in a single reply. If you need to
revise a file again, that's a new message - repeating the same file's block over and over in one
reply does not get applied more than once, just wastes time generating it and makes the Changes
list impossible to read. If you catch yourself about to write the same path a second time in this
reply, stop and move on to the next file instead.

Before any blocks, always write one or two plain sentences saying what you're about to do and why
- never send a reply that's nothing but code blocks back to back with no explanation. The user
needs to be able to tell what happened without opening every file.

You cannot see the result of a vinny-run command the instant you emit it - it runs after your
reply finishes. When a command you ran completes, its real output is automatically sent back to
you as the next message, starting with "${COMMAND_RESULT_PREFIX.trim()}" - that is the ONLY way
you ever see whether a command actually worked. Never claim something is "verified," "confirmed,"
or "tested" unless you are looking at one of those real result messages that proves it - if you
haven't received one yet, say what you expect it to show instead of asserting it already passed.`;

// Generation keeps running on the server even if every browser tab
// disconnects - it isn't tied to the HTTP request or the websocket, so
// closing the tab (or the phone locking) never loses a reply in progress.
// This map exists only so a Stop button can reach back into a generation
// that's still running and cancel it.
const activeGenerations = new Map<string, AbortController>();

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

interface ReportedCommandResult {
  index: number;
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

// Collects real command results per assistant message as they come in from
// the client (each CommandApproval reports its own once it actually runs),
// so the feedback message below is sent once, with every command from that
// reply included, not once per command.
const pendingCommandReports = new Map<string, ReportedCommandResult[]>();

const MAX_OUTPUT_CHARS = 4000;

function truncate(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  return `${text.slice(0, MAX_OUTPUT_CHARS)}\n...(truncated, ${text.length - MAX_OUTPUT_CHARS} more characters)`;
}

function formatCommandResult(r: ReportedCommandResult): string {
  const out = truncate(r.stdout.trim());
  const err = truncate(r.stderr.trim());
  return [
    `$ ${r.command}`,
    `exit code: ${r.exitCode ?? "(none - process may have been killed)"}${r.timedOut ? " (timed out)" : ""}`,
    out ? `stdout:\n${out}` : null,
    err ? `stderr:\n${err}` : null,
    !out && !err ? "(no output)" : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

/** Called once per command, as each one actually finishes running. Once
 * every command proposed in that message has reported in, sends their real
 * combined output back to Vinny as a new message and lets it react - this
 * is the only way Vinny ever finds out whether what it ran actually worked,
 * instead of having to guess or claim it without evidence. Caps the
 * resulting back-and-forth to one extra automatic reply (if the message
 * being reported on was itself already a reaction to an earlier report,
 * its own commands still run and get reported, but don't trigger yet
 * another automatic reply - the human has to say "next" from there, same
 * as any other reply, so this can never chain forever on its own). */
export function reportCommandResult(
  messageId: string,
  index: number,
  command: string,
  result: { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean },
): void {
  const projectId = getActiveProjectId();
  const history = listChatMessages(projectId);
  const msgIdx = history.findIndex((m) => m.id === messageId);
  if (msgIdx === -1) return;

  const expected = parseProposedCommands(history[msgIdx].content);
  if (expected.length === 0) return;

  const list = pendingCommandReports.get(messageId) ?? [];
  if (!list.some((r) => r.index === index)) {
    list.push({ index, command, ...result });
  }
  pendingCommandReports.set(messageId, list);
  if (list.length < expected.length) return;

  pendingCommandReports.delete(messageId);

  const precedingUser = msgIdx > 0 ? history[msgIdx - 1] : null;
  const isReaction =
    precedingUser?.role === "user" && precedingUser.content.startsWith(COMMAND_RESULT_PREFIX);

  const body = list
    .sort((a, b) => a.index - b.index)
    .map(formatCommandResult)
    .join("\n\n");
  const content = `${COMMAND_RESULT_PREFIX}Here is the real, actual output of the command(s) you just ran - not a prediction, this is what genuinely happened:\n\n${body}`;

  const now = new Date().toISOString();
  const userMessage: ChatMessage = { id: randomUUID(), role: "user", content, createdAt: now };
  insertChatMessage(userMessage, projectId);
  broadcast({ type: "chat:message", message: userMessage, projectId });

  if (isReaction) return;

  const assistantId = randomUUID();
  void runAssistantReply(assistantId, projectId);
}

/** Stops a reply that's still being generated. Whatever it had written so
 * far is kept and saved as-is (marked as stopped), rather than thrown away -
 * a partial edit is still worth having. Returns false if that reply has
 * already finished or doesn't exist. */
export function stopAssistantReply(assistantId: string): boolean {
  const controller = activeGenerations.get(assistantId);
  if (!controller) return false;
  controller.abort();
  return true;
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

/** Small local models can get stuck in a loop re-emitting the exact same
 * edit block for the same file over and over for the rest of a reply -
 * wasting the time it takes to generate dozens of duplicate full-file
 * blocks, and (since auto-approve applies every block it sees) triggering
 * a separate write+commit+push for each one. Counts how many edit blocks
 * target each path so a runaway loop can be caught early. */
function maxEditRepeatsForAnyPath(content: string): number {
  const counts = new Map<string, number>();
  for (const match of content.matchAll(EDIT_BLOCK_PATTERN)) {
    const path = match[1];
    counts.set(path, (counts.get(path) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

const REPEAT_LOOP_THRESHOLD = 4;

/** Collapses repeated edit blocks for the same path down to just the last
 * one, wherever they occur in the message - whether that's a genuine
 * runaway loop or the model just revising the same file a few times in one
 * reply, only the final version matters. Keeps the Changes tab (and what
 * gets applied/committed) to one card per path instead of one per attempt. */
function dedupeRepeatedEditBlocks(content: string): string {
  const matches = [...content.matchAll(EDIT_BLOCK_PATTERN)];
  if (matches.length < 2) return content;

  const lastIndexForPath = new Map<string, number>();
  matches.forEach((m, i) => lastIndexForPath.set(m[1], i));

  let result = "";
  let cursor = 0;
  matches.forEach((m, i) => {
    const matchStart = m.index ?? 0;
    result += content.slice(cursor, matchStart);
    if (lastIndexForPath.get(m[1]) === i) {
      result += m[0];
    }
    cursor = matchStart + m[0].length;
  });
  result += content.slice(cursor);
  return result;
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
  const controller = new AbortController();
  activeGenerations.set(assistantId, controller);
  let loopDetected = false;

  let messages = baseMessages;
  let full = "";
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      let attemptFull = "";
      try {
        for await (const delta of streamOllamaChat(
          messages,
          settings.ollamaModel,
          settings.ollamaContextSize,
          controller.signal,
        )) {
          attemptFull += delta;
          broadcast({ type: "chat:delta", id: assistantId, delta, projectId });

          // Check only when a block just closed, not on every token - cheap
          // enough to run on the whole buffer each time.
          if (
            delta.includes("```") &&
            maxEditRepeatsForAnyPath(attemptFull) > REPEAT_LOOP_THRESHOLD
          ) {
            loopDetected = true;
            controller.abort();
          }
        }
      } catch (err) {
        if (controller.signal.aborted) {
          full += attemptFull;
          break;
        }
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
  } finally {
    activeGenerations.delete(assistantId);
  }

  if (controller.signal.aborted) {
    const stoppedNote = loopDetected
      ? "\n\n*(stopped automatically - Vinny got stuck re-editing the same file over and over)*"
      : "\n\n*(stopped by user)*";
    full += stoppedNote;
    broadcast({ type: "chat:delta", id: assistantId, delta: stoppedNote, projectId });
  }

  // Whether from the loop-detector above or just the model revising the
  // same file more than once in one reply, only the last version of each
  // edit matters - keeps the Changes tab (and what gets applied/committed)
  // to one card per path instead of one per repeat.
  full = dedupeRepeatedEditBlocks(full);

  const assistantMessage: ChatMessage = {
    id: assistantId,
    role: "assistant",
    content: full,
    createdAt: new Date().toISOString(),
  };
  insertChatMessage(assistantMessage, projectId);
  broadcast({ type: "chat:done", id: assistantId, content: full, projectId });
}
