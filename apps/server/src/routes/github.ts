import type { FastifyInstance } from "fastify";
import { getSettings } from "../db.js";

interface GithubRepoApiEntry {
  full_name: string;
  html_url: string;
  private: boolean;
  updated_at: string;
}

export async function githubRoutes(fastify: FastifyInstance) {
  fastify.get("/repos", async (_request, reply) => {
    const token = getSettings().githubToken;
    if (!token) {
      reply.code(400).send({ error: "Add a GitHub personal access token in Settings first." });
      return;
    }

    let response: Response;
    try {
      response = await fetch(
        "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "vinny-editor",
          },
        },
      );
    } catch {
      reply.code(502).send({ error: "Couldn't reach GitHub." });
      return;
    }

    if (!response.ok) {
      const message =
        response.status === 401
          ? "That GitHub token was rejected - check it in Settings."
          : `GitHub returned ${response.status}.`;
      reply.code(502).send({ error: message });
      return;
    }

    const entries = (await response.json()) as GithubRepoApiEntry[];
    reply.send({
      repos: entries.map((r) => ({
        fullName: r.full_name,
        htmlUrl: r.html_url,
        private: r.private,
        updatedAt: r.updated_at,
      })),
    });
  });
}
