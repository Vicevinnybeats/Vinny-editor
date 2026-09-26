import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { runCommand } from "../exec.js";

const runBodySchema = z.object({ command: z.string().min(1) });

export async function execRoutes(fastify: FastifyInstance) {
  fastify.post("/run", async (request, reply) => {
    const { command } = runBodySchema.parse(request.body);
    reply.send(await runCommand(command));
  });
}
