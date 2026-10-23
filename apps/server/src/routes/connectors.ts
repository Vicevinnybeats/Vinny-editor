import type { FastifyInstance } from "fastify";
import { getSettings } from "../db.js";
import { env } from "../env.js";

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch(env.OLLAMA_BASE_URL, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkGithub(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "vinny-editor" },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function connectorsRoutes(fastify: FastifyInstance) {
  fastify.get("/status", async (_request, reply) => {
    const settings = getSettings();
    const [ollamaConnected, githubConnected] = await Promise.all([
      checkOllama(),
      checkGithub(settings.githubToken),
    ]);
    reply.send({
      ollama: {
        connected: ollamaConnected,
        model: settings.ollamaModel,
        baseUrl: env.OLLAMA_BASE_URL,
      },
      github: {
        connected: githubConnected,
        hasToken: Boolean(settings.githubToken),
      },
    });
  });
}
