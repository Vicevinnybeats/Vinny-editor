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

function ensureTerminal(): pty.IPty {
  if (ptyProcess) return ptyProcess;

  const shell = process.env.SHELL ?? "/bin/bash";
  ptyProcess = pty.spawn(shell, [], {
    name: "xterm-color",
    cols: 80,
    rows: 24,
    cwd: WORKSPACE_ROOT,
    env: process.env as Record<string, string>,
  });

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
  ensureTerminal().write(data);
}

export function resizeTerminal(cols: number, rows: number): void {
  ensureTerminal().resize(cols, rows);
}

/** Called on first client connect so a shell exists even before anyone types. */
export function startTerminalIfNeeded(): void {
  ensureTerminal();
}
