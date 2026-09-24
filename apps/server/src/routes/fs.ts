import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  FileTooLargeError,
  PathTraversalError,
  listDir,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "../workspace-fs.js";
import { broadcast } from "../ws-hub.js";

const pathQuerySchema = z.object({ path: z.string().default("") });
const writeBodySchema = z.object({ path: z.string(), content: z.string() });

export async function fsRoutes(fastify: FastifyInstance) {
  fastify.get("/tree", async (request, reply) => {
    const { path } = pathQuerySchema.parse(request.query);
    try {
      reply.send({ entries: listDir(path) });
    } catch (err) {
      handleFsError(err, reply);
    }
  });

  fastify.get("/file", async (request, reply) => {
    const { path } = pathQuerySchema.parse(request.query);
    try {
      const content = await readWorkspaceFile(path);
      reply.send({ path, content });
    } catch (err) {
      handleFsError(err, reply);
    }
  });

  fastify.put("/file", async (request, reply) => {
    const { path, content } = writeBodySchema.parse(request.body);
    try {
      await writeWorkspaceFile(path, content);
      broadcast({ type: "fs:changed", path });
      reply.send({ ok: true });
    } catch (err) {
      handleFsError(err, reply);
    }
  });
}

function handleFsError(err: unknown, reply: import("fastify").FastifyReply) {
  if (err instanceof PathTraversalError) {
    reply.code(400).send({ error: err.message });
    return;
  }
  if (err instanceof FileTooLargeError) {
    reply.code(413).send({ error: err.message });
    return;
  }
  reply.code(500).send({ error: err instanceof Error ? err.message : "filesystem error" });
}
