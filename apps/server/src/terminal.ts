import * as pty from "node-pty";
import { getSettings } from "./db.js";
import { getWorkspaceRoot } from "./workspace-fs.js";
import { broadcast } from "./ws-hub.js";

const MAX_BUFFER_CHARS = 200_000;

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
