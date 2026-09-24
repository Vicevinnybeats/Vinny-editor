import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { commitStaged, getDiff, getStatus, stageFile, unstageFile } from "../git.js";

const pathQuerySchema = z.object({
  path: z.string().optional(),
  staged: z.enum(["true", "false"]).optional(),
});
const pathBodySchema = z.object({ path: z.string() });
const commitBodySchema = z.object({ message: z.string().min(1) });

export async function gitRoutes(fastify: FastifyInstance) {
  fastify.get("/status", async (_request, reply) => {
    reply.send(await getStatus());
  });

  fastify.get("/diff", async (request, reply) => {
    const { path, staged } = pathQuerySchema.parse(request.query);
    reply.send({ diff: await getDiff(path, staged === "true") });
  });

  fastify.post("/stage", async (request, reply) => {
    const { path } = pathBodySchema.parse(request.body);
    await stageFile(path);
    reply.send({ status: await getStatus() });
  });

  fastify.post("/unstage", async (request, reply) => {
    const { path } = pathBodySchema.parse(request.body);
    await unstageFile(path);
    reply.send({ status: await getStatus() });
  });

  fastify.post("/commit", async (request, reply) => {
    const { message } = commitBodySchema.parse(request.body);
    await commitStaged(message);
    reply.send({ status: await getStatus() });
  });
}
