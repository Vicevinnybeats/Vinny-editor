import * as pty from "node-pty";
import { WORKSPACE_ROOT } from "./workspace-fs.js";
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
      cwd: WORKSPACE_ROOT,
      env: process.env as Record<string, string>,
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
