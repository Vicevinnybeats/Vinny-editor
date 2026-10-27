import * as pty from "node-pty";
import {
  getActiveProjectId,
  getSettings,
  listChatMessages,
  listProjects,
  setProjectPreviewPort,
} from "./db.js";
import { getWorkspaceRoot } from "./workspace-fs.js";
import { broadcast } from "./ws-hub.js";

const MAX_BUFFER_CHARS = 200_000;

// Matches the port a dev server prints on startup across the common
// frameworks' output styles, e.g. "http://localhost:3000",
// "Local: http://localhost:5173/", "listening on 0.0.0.0:8080".
const DEV_SERVER_PORT_PATTERN = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})\b/;

/** When a dev server started by the user (manually, via a setup script, or
 * by Vinny itself with a vinny-run block) prints the port it's listening
 * on, pick it up automatically and wire it into the Preview tab - so
 * "npm run dev" is the only thing anyone, human or Vinny, ever has to
 * actually run. Only fills in a port that isn't already set, so it never
 * overrides a port the user picked on purpose. */
function maybeDetectPreviewPort(chunk: string): void {
  const match = DEV_SERVER_PORT_PATTERN.exec(chunk);
  if (!match) return;
  const port = Number(match[1]);

  const projectId = getActiveProjectId();
  if (!projectId) return;
  const project = listProjects().find((p) => p.id === projectId);
  if (!project || project.previewPort === port) return;
  if (project.previewPort !== null) return;

  setProjectPreviewPort(projectId, port);
  broadcast({
    type: "projects:changed",
    projects: listProjects(),
    activeProjectId: getActiveProjectId(),
    chatHistory: listChatMessages(getActiveProjectId()),
  });
}

let ptyProcess: pty.IPty | null = null;
let outputBuffer = "";

function appendToBuffer(data: string) {
  outputBuffer += data;
  if (outputBuffer.length > MAX_BUFFER_CHARS) {
    outputBuffer = outputBuffer.slice(outputBuffer.length - MAX_BUFFER_CHARS);
  }
}

function defaultShell(): string {
  if (process.platform === "win32") {
    return process.env.COMSPEC ?? "powershell.exe";
  }
  return process.env.SHELL ?? "/bin/bash";
}

function ensureTerminal(): pty.IPty | null {
  if (ptyProcess) return ptyProcess;

  try {
    ptyProcess = pty.spawn(defaultShell(), [], {
      name: "xterm-color",
      cols: 80,
      rows: 24,
      cwd: getWorkspaceRoot(),
      env: { ...process.env, ...getSettings().environmentVariables } as Record<string, string>,
    });
  } catch (err) {
    console.error("Failed to start terminal shell:", err instanceof Error ? err.message : err);
    return null;
  }

  ptyProcess.onData((data) => {
    appendToBuffer(data);
    broadcast({ type: "terminal:output", data });
    maybeDetectPreviewPort(data);
  });

  ptyProcess.onExit(() => {
    ptyProcess = null;
  });

  return ptyProcess;
}

export function getTerminalBuffer(): string {
  return outputBuffer;
}

export function writeTerminalInput(data: string): void {
  ensureTerminal()?.write(data);
}

export function resizeTerminal(cols: number, rows: number): void {
  ensureTerminal()?.resize(cols, rows);
}

/** Called on first client connect so a shell exists even before anyone types. */
export function startTerminalIfNeeded(): void {
  ensureTerminal();
}

/** Kills the current shell and starts a fresh one in the new active
 * project's folder - a running shell's cwd can't be changed after spawn. */
export function restartTerminal(): void {
  if (ptyProcess) {
    try {
      ptyProcess.kill();
    } catch {
      // already dead
    }
    ptyProcess = null;
  }
  outputBuffer = "";
  ensureTerminal();
}

/** Types the saved setup script into the (already-restarted) terminal, as if
 * the user had typed it themselves - runs it in the new active project's
 * shell, with the saved environment variables already in scope. Called on
 * every project switch, so it should be safe to run more than once. */
export function runSetupScriptIfConfigured(): void {
  const script = getSettings().setupScript.trim();
  if (!script) return;
  ensureTerminal()?.write(`${script}\r`);
}
