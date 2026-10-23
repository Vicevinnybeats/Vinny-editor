import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addProject,
  clearTabs,
  getActiveProjectId,
  getSettings,
  listChatMessages,
  listProjects,
  removeProject,
  setActiveProjectId,
} from "../db.js";
import { CloneError, cloneRepo, createRepo, initAndPushNewRepo } from "../github.js";
import { restartTerminal } from "../terminal.js";
import { restartWorkspaceWatcher } from "../watcher.js";
import { broadcast } from "../ws-hub.js";
import { setWorkspaceRoot } from "../workspace-fs.js";

const addBodySchema = z.object({ name: z.string().min(1), path: z.string().min(1) });
const cloneBodySchema = z.object({
  url: z.string().min(1),
  token: z.string().optional(),
  name: z.string().optional(),
});
const switchBodySchema = z.object({ id: z.string() });
const idParamSchema = z.object({ id: z.string() });

function broadcastProjects() {
  broadcast({
    type: "projects:changed",
    projects: listProjects(),
    activeProjectId: getActiveProjectId(),
    chatHistory: listChatMessages(getActiveProjectId()),
  });
}

/** Makes `id` the active project: re-points every workspace-scoped service
 * at its folder, clears tabs (they belonged to whatever was active before),
 * and broadcasts the result. Used both for an explicit switch and right
 * after creating a project - starting a new chat/session means landing in
 * it immediately, not just adding it to the list. */
async function activateProject(id: string): Promise<void> {
  const project = listProjects().find((p) => p.id === id);
  if (!project) return;

  setWorkspaceRoot(project.path);
  clearTabs();
  await restartWorkspaceWatcher();
  restartTerminal();
  setActiveProjectId(id);

  broadcast({ type: "tabs:changed", tabs: [] });
  broadcastProjects();
}

export async function projectsRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    reply.send({ projects: listProjects(), activeProjectId: getActiveProjectId() });
  });

  fastify.post("/", async (request, reply) => {
    const { name, path } = addBodySchema.parse(request.body);
    const resolved = resolve(path);
    let stats;
    try {
      stats = statSync(resolved);
    } catch {
      reply.code(400).send({ error: "That folder doesn't exist on this PC." });
      return;
    }
    if (!stats.isDirectory()) {
      reply.code(400).send({ error: "That path isn't a folder." });
      return;
    }
    const token = getSettings().githubToken;
    if (!token) {
      reply.code(400).send({
        error:
          "Add a GitHub personal access token in Settings first - new chats are synced to GitHub automatically.",
      });
      return;
    }

    let githubUrl: string;
    try {
      const repo = await createRepo(name, token, true);
      await initAndPushNewRepo(resolved, repo.cloneUrl, token);
      githubUrl = repo.htmlUrl;
    } catch (err) {
      reply.code(400).send({
        error: err instanceof CloneError ? err.message : "Couldn't set up the GitHub repo.",
      });
      return;
    }

    const project = addProject(name, resolved, githubUrl);
    await activateProject(project.id);
    reply.send({ project });
  });

  fastify.post("/clone", async (request, reply) => {
    const { url, token, name } = cloneBodySchema.parse(request.body);
    try {
      const cloned = await cloneRepo(url, token, name);
      const project = addProject(cloned.name, cloned.path, url);
      await activateProject(project.id);
      reply.send({ project });
    } catch (err) {
      reply.code(400).send({ error: err instanceof CloneError ? err.message : "Clone failed" });
    }
  });

  fastify.post("/switch", async (request, reply) => {
    const { id } = switchBodySchema.parse(request.body);
    if (!listProjects().some((p) => p.id === id)) {
      reply.code(404).send({ error: "Unknown project" });
      return;
    }
    await activateProject(id);
    reply.send({ projects: listProjects(), activeProjectId: id });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const wasActive = getActiveProjectId() === id;
    removeProject(id);

    if (wasActive) {
      // Deleting the chat you're currently in has to land you somewhere -
      // otherwise the workspace root, terminal, and watcher all keep
      // pointing at a project that no longer exists in the list.
      const remaining = listProjects();
      if (remaining.length > 0) {
        await activateProject(remaining[0].id);
      } else {
        setActiveProjectId(null);
        broadcastProjects();
      }
    } else {
      broadcastProjects();
    }

    reply.send({ projects: listProjects(), activeProjectId: getActiveProjectId() });
  });
}
