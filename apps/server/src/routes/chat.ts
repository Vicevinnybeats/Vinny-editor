import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listChatMessages } from "../db.js";
import { sendUserMessage } from "../chat.js";

const sendBodySchema = z.object({ content: z.string().min(1) });

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get("/history", async (_request, reply) => {
    reply.send({ messages: listChatMessages() });
  });

  fastify.post("/message", async (request, reply) => {
    const { content } = sendBodySchema.parse(request.body);
    const { userMessage, assistantId } = sendUserMessage(content);
    reply.code(202).send({ userMessage, assistantId });
  });
}
