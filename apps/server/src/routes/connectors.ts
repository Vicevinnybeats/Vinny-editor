import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  addConnector,
  getConnectorAuth,
  getSettings,
  listConnectors,
  removeConnector,
} from "../db.js";
import { env } from "../env.js";

const addBodySchema = z.object({
  name: z.string().min(1),
  url: z.string().min(1),
  token: z.string().optional(),
});
const idParamSchema = z.object({ id: z.string() });

/** A custom connector's "connected" check is a plain reachability probe -
 * any HTTP response (even 401/403) means the service is up, since this
 * isn't a known API whose auth scheme we can validate like Ollama/GitHub. */
async function checkCustomConnector(url: string, token: string | null): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      signal: AbortSignal.timeout(4000),
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

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

  fastify.get("/custom", async (_request, reply) => {
    const connectors = listConnectors();
    const statuses = await Promise.all(
      connectors.map((c) => {
        const auth = getConnectorAuth(c.id);
        return checkCustomConnector(c.url, auth?.token ?? null);
      }),
    );
    reply.send({
      connectors: connectors.map((c, i) => ({ ...c, connected: statuses[i] })),
    });
  });

  fastify.post("/custom", async (request, reply) => {
    const { name, url, token } = addBodySchema.parse(request.body);
    const connector = addConnector(name, url, token || null);
    reply.send({ connector });
  });

  fastify.delete("/custom/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    removeConnector(id);
    reply.send({ ok: true });
  });
}
