import { statSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addProject,
  clearTabs,
  getActiveProjectId,
  listProjects,
  removeProject,
  setActiveProjectId,
} from "../db.js";
import { restartTerminal } from "../terminal.js";
import { restartWorkspaceWatcher } from "../watcher.js";
import { broadcast } from "../ws-hub.js";
import { setWorkspaceRoot } from "../workspace-fs.js";

const addBodySchema = z.object({ name: z.string().min(1), path: z.string().min(1) });
const switchBodySchema = z.object({ id: z.string() });
const idParamSchema = z.object({ id: z.string() });

function broadcastProjects() {
  broadcast({
    type: "projects:changed",
    projects: listProjects(),
    activeProjectId: getActiveProjectId(),
  });
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
    const project = addProject(name, resolved);
    broadcastProjects();
    reply.send({ project });
  });

  fastify.post("/switch", async (request, reply) => {
    const { id } = switchBodySchema.parse(request.body);
    const project = listProjects().find((p) => p.id === id);
    if (!project) {
      reply.code(404).send({ error: "Unknown project" });
      return;
    }

    setWorkspaceRoot(project.path);
    clearTabs();
    await restartWorkspaceWatcher();
    restartTerminal();
    setActiveProjectId(id);

    broadcast({ type: "tabs:changed", tabs: [] });
    broadcastProjects();
    reply.send({ projects: listProjects(), activeProjectId: id });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    removeProject(id);
    if (getActiveProjectId() === id) setActiveProjectId(null);
    broadcastProjects();
    reply.send({ projects: listProjects(), activeProjectId: getActiveProjectId() });
  });
}
