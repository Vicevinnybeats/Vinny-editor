import { spawn } from "node:child_process";
import { rgPath } from "@vscode/ripgrep";
import type { SearchMatch } from "@vinny-editor/shared";
import { WORKSPACE_ROOT } from "./workspace-fs.js";

interface RgMatchMessage {
  type: "match";
  data: {
    path: { text: string };
    lines: { text: string };
    line_number: number;
    submatches: { start: number; end: number }[];
  };
}

function isRgMatch(value: unknown): value is RgMatchMessage {
  return (
    typeof value === "object" && value !== null && (value as { type?: unknown }).type === "match"
  );
}

export function searchWorkspace(query: string, limit = 200): Promise<SearchMatch[]> {
  return new Promise((resolvePromise, rejectPromise) => {
    if (!query.trim()) {
      resolvePromise([]);
      return;
    }

    const proc = spawn(
      rgPath,
      ["--json", "--max-count", "50", "--max-filesize", "2M", "-e", query, "."],
      { cwd: WORKSPACE_ROOT },
    );

    const results: SearchMatch[] = [];
    let buffer = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          continue;
        }
        if (isRgMatch(parsed) && results.length < limit) {
          const { path, lines: matchedLines, line_number, submatches } = parsed.data;
          const first = submatches[0];
          results.push({
            path: path.text.replace(/^\.\//, ""),
            line: line_number,
            text: matchedLines.text.replace(/\n$/, ""),
            matchStart: first?.start ?? 0,
            matchEnd: first?.end ?? 0,
          });
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    proc.on("error", rejectPromise);
    proc.on("close", (code) => {
      // ripgrep exits 1 when there are simply no matches - not an error.
      if (code !== 0 && code !== 1) {
        rejectPromise(new Error(stderr || `ripgrep exited with code ${code}`));
        return;
      }
      resolvePromise(results);
    });
  });
}
