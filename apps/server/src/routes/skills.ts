import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { addSkill, listSkills, removeSkill, setSkillEnabled } from "../db.js";

const addBodySchema = z.object({ name: z.string().min(1), content: z.string().min(1) });
const fetchBodySchema = z.object({
  url: z.string().min(1),
  path: z.string().optional(),
  name: z.string().optional(),
});
const toggleBodySchema = z.object({ enabled: z.boolean() });
const idParamSchema = z.object({ id: z.string() });

/** Builds the raw-content URLs worth trying for a skill source, in order.
 * Handles a plain repo URL (optionally with a subfolder for a repo that
 * hosts several skills), a GitHub "blob" URL to one exact file, and falls
 * back to treating anything else as an already-direct URL. */
function candidateUrls(inputUrl: string, path?: string): string[] {
  if (!/github\.com/.test(inputUrl)) return [inputUrl];

  const blobMatch = inputUrl.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
  if (blobMatch) {
    const [, owner, repo, branch, filePath] = blobMatch;
    return [`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`];
  }

  const repoMatch = inputUrl.match(/github\.com\/([^/]+)\/([^/]+?)(\.git)?\/?$/);
  if (repoMatch) {
    const [, owner, repo] = repoMatch;
    const base = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD`;
    const folder = path ? `/${path.replace(/^\/+|\/+$/g, "")}` : "";
    return [
      `${base}${folder}/SKILL.md`,
      `${base}${folder}/skill.md`,
      ...(folder ? [] : [`${base}/README.md`]),
    ];
  }

  return [inputUrl];
}

function deriveName(inputUrl: string, path?: string): string {
  if (path)
    return (
      path
        .replace(/^\/+|\/+$/g, "")
        .split("/")
        .pop() ?? path
    );
  const repoMatch = inputUrl.match(/github\.com\/[^/]+\/([^/]+?)(\.git)?\/?$/);
  if (repoMatch) return repoMatch[1];
  return inputUrl.split("/").filter(Boolean).pop() ?? "skill";
}

async function fetchSkillContent(
  inputUrl: string,
  path: string | undefined,
  nameOverride: string | undefined,
): Promise<{ content: string; name: string }> {
  let lastError = "Couldn't find a SKILL.md or README.md there.";
  for (const candidate of candidateUrls(inputUrl, path)) {
    let response: Response;
    try {
      response = await fetch(candidate, { headers: { "User-Agent": "vinny-editor" } });
    } catch {
      lastError = `Couldn't reach ${candidate}`;
      continue;
    }
    if (!response.ok) {
      lastError = `GitHub returned ${response.status} for ${candidate}`;
      continue;
    }
    const content = await response.text();
    if (content.trim().length === 0) {
      lastError = `${candidate} was empty`;
      continue;
    }
    return { content, name: nameOverride?.trim() || deriveName(inputUrl, path) };
  }
  throw new Error(lastError);
}

export async function skillsRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    reply.send({ skills: listSkills() });
  });

  fastify.post("/", async (request, reply) => {
    const { name, content } = addBodySchema.parse(request.body);
    const skill = addSkill(name, content, null);
    reply.send({ skill });
  });

  fastify.post("/fetch", async (request, reply) => {
    const { url, path, name } = fetchBodySchema.parse(request.body);
    try {
      const { content, name: resolvedName } = await fetchSkillContent(url, path, name);
      const skill = addSkill(resolvedName, content, url);
      reply.send({ skill });
    } catch (err) {
      reply.code(400).send({
        error: err instanceof Error ? err.message : "Couldn't fetch that skill.",
      });
    }
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    const { enabled } = toggleBodySchema.parse(request.body);
    setSkillEnabled(id, enabled);
    reply.send({ skills: listSkills() });
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = idParamSchema.parse(request.params);
    removeSkill(id);
    reply.send({ skills: listSkills() });
  });
}
