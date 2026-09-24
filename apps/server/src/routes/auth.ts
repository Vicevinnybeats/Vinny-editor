import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  clearSessionCookie,
  isRequestAuthed,
  passphraseMatches,
  setSessionCookie,
} from "../auth.js";

const loginBodySchema = z.object({ passphrase: z.string().min(1) });

export async function authRoutes(fastify: FastifyInstance) {
  fastify.post("/login", async (request, reply) => {
    const parsed = loginBodySchema.safeParse(request.body);
    if (!parsed.success) {
      reply.code(400).send({ error: "invalid request" });
      return;
    }
    if (!passphraseMatches(parsed.data.passphrase)) {
      reply.code(401).send({ error: "incorrect passphrase" });
      return;
    }
    setSessionCookie(reply);
    reply.send({ ok: true });
  });

  fastify.post("/logout", async (_request, reply) => {
    clearSessionCookie(reply);
    reply.send({ ok: true });
  });

  fastify.get("/status", async (request, reply) => {
    reply.send({ authenticated: isRequestAuthed(request) });
  });
}
