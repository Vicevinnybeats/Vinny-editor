import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import websocketPlugin from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import { clientMessageSchema, type ServerMessage, type StateSnapshot } from "@vinny-editor/shared";
import { requireAuth } from "./auth.js";
import {
  addProject,
  getActiveProjectId,
  getSettings,
  listChatMessages,
  listProjects,
  listTabs,
  setActiveProjectId,
} from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { fsRoutes } from "./routes/fs.js";
import { tabsRoutes } from "./routes/tabs.js";
import { gitRoutes } from "./routes/git.js";
import { searchRoutes } from "./routes/search.js";
import { settingsRoutes } from "./routes/settings.js";
import { chatRoutes } from "./routes/chat.js";
import { execRoutes } from "./routes/exec.js";
import { githubRoutes } from "./routes/github.js";
import { connectorsRoutes } from "./routes/connectors.js";
import { projectsRoutes } from "./routes/projects.js";
import { registerSocket } from "./ws-hub.js";
import {
  getTerminalBuffer,
  resizeTerminal,
  startTerminalIfNeeded,
  writeTerminalInput,
} from "./terminal.js";
import { startWorkspaceWatcher } from "./watcher.js";
import { getWorkspaceRoot, setWorkspaceRoot } from "./workspace-fs.js";

/** On first boot there are no saved projects yet - seed one from the
 * env-configured WORKSPACE_ROOT so existing setups keep working unchanged.
 * On later boots, re-point the workspace root at whichever project was
 * active last time (falling back to the first saved one if that project
 * was since removed). */
function ensureActiveProject() {
  const projects = listProjects();
  if (projects.length === 0) {
    const seeded = addProject("Default", getWorkspaceRoot());
    setActiveProjectId(seeded.id);
    return;
  }
  const active = projects.find((p) => p.id === getActiveProjectId()) ?? projects[0];
  setWorkspaceRoot(active.path);
  if (getActiveProjectId() !== active.id) setActiveProjectId(active.id);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIST = join(__dirname, "../../web/dist");

export function buildServer() {
  // Default is 1 MB - too small for an uploaded photo/video/audio file.
  const fastify = Fastify({ logger: true, bodyLimit: 200 * 1024 * 1024 });

  ensureActiveProject();

  fastify.register(cookie);
  fastify.register(websocketPlugin);

  if (existsSync(WEB_DIST)) {
    fastify.register(fastifyStatic, { root: WEB_DIST });

    // @fastify/static always sets its own Cache-Control after `setHeaders`
    // runs, so that option can't be used to override it - an onSend hook
    // runs last and wins. The HTML shell and the service-worker/manifest
    // files must never be cached (by the browser or an intermediary like a
    // Cloudflare Quick Tunnel) - they're how a client discovers a new build
    // exists. Hashed asset filenames change on every build, so those are
    // safe to cache aggressively.
    fastify.addHook("onSend", async (request, reply) => {
      const url = request.raw.url ?? "";
      if (
        url === "/" ||
        url.endsWith(".html") ||
        url.endsWith("sw.js") ||
        url.endsWith("registerSW.js") ||
        url.endsWith("manifest.webmanifest")
      ) {
        reply.header("Cache-Control", "no-store");
      } else if (url.startsWith("/assets/")) {
        reply.header("Cache-Control", "public, max-age=31536000, immutable");
      }
    });
  }

  fastify.get("/health", async () => ({ status: "ok" }));

  fastify.register(authRoutes, { prefix: "/api/auth" });

  fastify.register(
    async (instance) => {
      instance.addHook("preHandler", requireAuth);
      instance.register(fsRoutes, { prefix: "/fs" });
      instance.register(tabsRoutes, { prefix: "/tabs" });
      instance.register(gitRoutes, { prefix: "/git" });
      instance.register(searchRoutes, { prefix: "/search" });
      instance.register(settingsRoutes, { prefix: "/settings" });
      instance.register(chatRoutes, { prefix: "/chat" });
      instance.register(execRoutes, { prefix: "/exec" });
      instance.register(projectsRoutes, { prefix: "/projects" });
      instance.register(githubRoutes, { prefix: "/github" });
      instance.register(connectorsRoutes, { prefix: "/connectors" });
    },
    { prefix: "/api" },
  );

  fastify.register(async (instance) => {
    instance.get("/ws", { preHandler: requireAuth, websocket: true }, (socket) => {
      registerSocket(socket);
      startTerminalIfNeeded();

      const snapshot: StateSnapshot = {
        type: "state:snapshot",
        settings: getSettings(),
        tabs: listTabs(),
        chatHistory: listChatMessages(getActiveProjectId()),
        terminalBuffer: getTerminalBuffer(),
        serverTime: new Date().toISOString(),
        projects: listProjects(),
        activeProjectId: getActiveProjectId(),
      };
      send(socket, snapshot);

      socket.on("message", (raw: Buffer) => {
        let json: unknown;
        try {
          json = JSON.parse(raw.toString());
        } catch {
          return;
        }
        const parsed = clientMessageSchema.safeParse(json);
        if (!parsed.success) {
          fastify.log.warn({ err: parsed.error }, "invalid client message");
          return;
        }
        switch (parsed.data.type) {
          case "ping":
            send(socket, { type: "pong" });
            break;
          case "terminal:input":
            writeTerminalInput(parsed.data.data);
            break;
          case "terminal:resize":
            resizeTerminal(parsed.data.cols, parsed.data.rows);
            break;
          case "client:hello":
            break;
        }
      });
    });
  });

  if (existsSync(WEB_DIST)) {
    fastify.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith("/api") || request.raw.url?.startsWith("/ws")) {
        reply.code(404).send({ error: "not found" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  startWorkspaceWatcher();

  return fastify;
}

function send(socket: { send: (data: string) => void }, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}
