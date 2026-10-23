import { mkdirSync, readdirSync, statSync } from "node:fs";
import { readFile as readFileAsync, writeFile as writeFileAsync, mkdir } from "node:fs/promises";
import { resolve, relative, dirname, join, sep } from "node:path";
import type { FileEntry } from "@vinny-editor/shared";
import { env } from "./env.js";

let workspaceRoot = resolve(env.WORKSPACE_ROOT);
mkdirSync(workspaceRoot, { recursive: true });

export function getWorkspaceRoot(): string {
  return workspaceRoot;
}

/** Switches the active project root for every workspace-scoped operation
 * (fs, git, search, exec, the terminal, the file watcher). Creates the
 * folder if it doesn't already exist. */
export function setWorkspaceRoot(path: string): void {
  const resolved = resolve(path);
  mkdirSync(resolved, { recursive: true });
  workspaceRoot = resolved;
}

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

/** Resolves a client-supplied relative path against the active project root, refusing anything that escapes it. */
export function resolveSafePath(relPath: string): string {
  const normalizedRel = relPath.replace(/^[/\\]+/, "");
  const resolved = resolve(workspaceRoot, normalizedRel);
  const rel = relative(workspaceRoot, resolved);
  if (rel === "" || rel === ".") return resolved;
  if (rel.startsWith("..") || rel.split(sep)[0] === "..") {
    throw new PathTraversalError(relPath);
  }
  return resolved;
}

export function toWorkspaceRelative(absPath: string): string {
  return relative(workspaceRoot, absPath).split(sep).join("/");
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

/** Writes raw bytes rather than text - used for uploads (photos, video,
 * audio, PDFs, ...) where treating the content as a utf8 string would
 * corrupt it. */
export async function writeWorkspaceFileBinary(relPath: string, data: Buffer): Promise<void> {
  const abs = resolveSafePath(relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFileAsync(abs, data);
}
