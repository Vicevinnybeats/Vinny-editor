import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clearChatMessages, getActiveProjectId, listChatMessages } from "../db.js";
import { sendUserMessage } from "../chat.js";
import { broadcast } from "../ws-hub.js";

const sendBodySchema = z.object({ content: z.string().min(1) });

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get("/history", async (_request, reply) => {
    reply.send({ messages: listChatMessages(getActiveProjectId()) });
  });

  fastify.post("/message", async (request, reply) => {
    const { content } = sendBodySchema.parse(request.body);
    const { userMessage, assistantId } = sendUserMessage(content);
    reply.code(202).send({ userMessage, assistantId });
  });

  // Clears only this project's conversation - the project's files and
  // GitHub repo are untouched. Lets a chat that's grown huge (and so slow
  // to generate from) be reset without losing any actual work.
  fastify.delete("/history", async (_request, reply) => {
    const projectId = getActiveProjectId();
    clearChatMessages(projectId);
    broadcast({ type: "chat:cleared", projectId });
    reply.send({ ok: true });
  });
}
