import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { clearChatMessages, getActiveProjectId, listChatMessages } from "../db.js";
import { sendUserMessage, stopAssistantReply } from "../chat.js";
import { broadcast } from "../ws-hub.js";

const sendBodySchema = z.object({ content: z.string().min(1) });
const stopBodySchema = z.object({ assistantId: z.string() });

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.get("/history", async (_request, reply) => {
    reply.send({ messages: listChatMessages(getActiveProjectId()) });
  });

  fastify.post("/message", async (request, reply) => {
    const { content } = sendBodySchema.parse(request.body);
    const { userMessage, assistantId } = sendUserMessage(content);
    reply.code(202).send({ userMessage, assistantId });
  });

  // Stops a reply that's still generating - whatever it had written so far
  // is kept (marked as stopped) rather than thrown away.
  fastify.post("/stop", async (request, reply) => {
    const { assistantId } = stopBodySchema.parse(request.body);
    const stopped = stopAssistantReply(assistantId);
    reply.send({ stopped });
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
