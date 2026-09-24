import Fastify from "fastify";
import websocketPlugin from "@fastify/websocket";
import { clientMessageSchema, type ServerMessage, type StateSnapshot } from "@vinny-editor/shared";
import { getSettings } from "./db.js";

export function buildServer() {
  const fastify = Fastify({ logger: true });

  fastify.register(websocketPlugin);

  fastify.get("/health", async () => ({ status: "ok" }));

  fastify.register(async (instance) => {
    instance.get("/ws", { websocket: true }, (socket) => {
      const snapshot: StateSnapshot = {
        type: "state:snapshot",
        settings: getSettings(),
        serverTime: new Date().toISOString(),
      };
      send(socket, snapshot);

      socket.on("message", (raw: Buffer) => {
        const parsed = clientMessageSchema.safeParse(JSON.parse(raw.toString()));
        if (!parsed.success) {
          fastify.log.warn({ err: parsed.error }, "invalid client message");
          return;
        }
        if (parsed.data.type === "ping") {
          send(socket, { type: "pong" });
        }
      });
    });
  });

  return fastify;
}

function send(socket: { send: (data: string) => void }, message: ServerMessage) {
  socket.send(JSON.stringify(message));
}
