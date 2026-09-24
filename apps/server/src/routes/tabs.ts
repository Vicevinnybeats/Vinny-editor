import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { closeTab, listTabs, openTab, updateTabBuffer } from "../db.js";
import { readWorkspaceFile } from "../workspace-fs.js";
import { broadcast } from "../ws-hub.js";

const pathBodySchema = z.object({ path: z.string() });
const bufferBodySchema = z.object({ path: z.string(), buffer: z.string(), dirty: z.boolean() });

export async function tabsRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    reply.send({ tabs: listTabs() });
  });

  fastify.post("/open", async (request, reply) => {
    const { path } = pathBodySchema.parse(request.body);
    const content = await readWorkspaceFile(path);
    const tabs = openTab(path, content);
    broadcast({ type: "tabs:changed", tabs });
    reply.send({ tabs });
  });

  fastify.post("/close", async (request, reply) => {
    const { path } = pathBodySchema.parse(request.body);
    const tabs = closeTab(path);
    broadcast({ type: "tabs:changed", tabs });
    reply.send({ tabs });
  });

  fastify.put("/buffer", async (request, reply) => {
    const { path, buffer, dirty } = bufferBodySchema.parse(request.body);
    const tabs = updateTabBuffer(path, buffer, dirty);
    broadcast({ type: "tabs:changed", tabs });
    reply.send({ tabs });
  });
}
