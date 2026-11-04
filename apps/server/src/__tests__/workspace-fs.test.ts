import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { PathTraversalError, resolveSafePath, getWorkspaceRoot } from "../workspace-fs.js";

const WORKSPACE_ROOT = getWorkspaceRoot();

describe("resolveSafePath", () => {
  it("resolves a plain relative path inside the workspace", () => {
    expect(resolveSafePath("src/index.ts")).toBe(join(WORKSPACE_ROOT, "src", "index.ts"));
  });

  it("resolves the workspace root itself", () => {
    expect(resolveSafePath("")).toBe(WORKSPACE_ROOT);
  });

  it("rejects a simple ../ traversal", () => {
    expect(() => resolveSafePath("../secrets.env")).toThrow(PathTraversalError);
  });

  it("rejects a nested ../../ traversal", () => {
    expect(() => resolveSafePath("a/b/../../../etc/passwd")).toThrow(PathTraversalError);
  });

  it("treats a leading slash as workspace-root-relative rather than a real absolute path", () => {
    // A leading "/" is stripped, so this re-roots inside the sandbox instead of
    // reaching the real /etc/passwd - it must never throw or escape.
    expect(resolveSafePath("/etc/passwd")).toBe(join(WORKSPACE_ROOT, "etc", "passwd"));
  });

  it("rejects a path that merely starts with the workspace root as a string prefix", () => {
    // e.g. WORKSPACE_ROOT = /home/user/workspace, this targets /home/user/workspace-evil
    expect(() => resolveSafePath(`../${basename(WORKSPACE_ROOT)}-evil`)).toThrow(
      PathTraversalError,
    );
  });
});
