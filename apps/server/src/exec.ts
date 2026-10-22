import { exec } from "node:child_process";
import { getWorkspaceRoot } from "./workspace-fs.js";

const TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 200_000;

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
}

export function runCommand(command: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    exec(
      command,
      { cwd: getWorkspaceRoot(), timeout: TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout, stderr, exitCode: 0, timedOut: false });
          return;
        }
        resolve({
          stdout,
          stderr,
          exitCode: typeof error.code === "number" ? error.code : null,
          timedOut: Boolean(error.killed && error.signal === "SIGTERM"),
        });
      },
    );
  });
}
