import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { searchWorkspace } from "../search.js";

const querySchema = z.object({ q: z.string().default("") });

export async function searchRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (request, reply) => {
    const { q } = querySchema.parse(request.query);
    try {
      reply.send({ matches: await searchWorkspace(q) });
    } catch (err) {
      reply.code(500).send({ error: err instanceof Error ? err.message : "search failed" });
    }
  });
}
