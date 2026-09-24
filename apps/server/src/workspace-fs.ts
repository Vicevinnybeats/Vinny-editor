import { mkdirSync, readdirSync, statSync } from "node:fs";
import { readFile as readFileAsync, writeFile as writeFileAsync, mkdir } from "node:fs/promises";
import { resolve, relative, dirname, join, sep } from "node:path";
import type { FileEntry } from "@vinny-editor/shared";
import { env } from "./env.js";

export const WORKSPACE_ROOT = resolve(env.WORKSPACE_ROOT);
mkdirSync(WORKSPACE_ROOT, { recursive: true });

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB

const IGNORED = new Set([".git", "node_modules", ".DS_Store"]);

export class PathTraversalError extends Error {
  constructor(path: string) {
    super(`Path escapes workspace root: ${path}`);
    this.name = "PathTraversalError";
  }
}

export class FileTooLargeError extends Error {
  constructor(path: string) {
    super(`File too large to open: ${path}`);
    this.name = "FileTooLargeError";
  }
}

/** Resolves a client-supplied relative path against WORKSPACE_ROOT, refusing anything that escapes it. */
export function resolveSafePath(relPath: string): string {
  const normalizedRel = relPath.replace(/^[/\\]+/, "");
  const resolved = resolve(WORKSPACE_ROOT, normalizedRel);
  const rel = relative(WORKSPACE_ROOT, resolved);
  if (rel === "" || rel === ".") return resolved;
  if (rel.startsWith("..") || rel.split(sep)[0] === "..") {
    throw new PathTraversalError(relPath);
  }
  return resolved;
}

export function toWorkspaceRelative(absPath: string): string {
  return relative(WORKSPACE_ROOT, absPath).split(sep).join("/");
}

export function listDir(relPath: string): FileEntry[] {
  const abs = resolveSafePath(relPath);
  const entries = readdirSync(abs, { withFileTypes: true });
  return entries
    .filter((e) => !IGNORED.has(e.name))
    .map((e) => ({
      name: e.name,
      path: toWorkspaceRelative(join(abs, e.name)),
      type: e.isDirectory() ? ("directory" as const) : ("file" as const),
    }))
    .sort((a, b) =>
      a.type === b.type ? a.name.localeCompare(b.name) : a.type === "directory" ? -1 : 1,
    );
}

export async function readWorkspaceFile(relPath: string): Promise<string> {
  const abs = resolveSafePath(relPath);
  const stats = statSync(abs);
  if (stats.size > MAX_FILE_BYTES) throw new FileTooLargeError(relPath);
  return readFileAsync(abs, "utf8");
}

export async function writeWorkspaceFile(relPath: string, content: string): Promise<void> {
  const abs = resolveSafePath(relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFileAsync(abs, content, "utf8");
}
