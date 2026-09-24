import type { FastifyInstance } from "fastify";
import { settingsSchema } from "@vinny-editor/shared";
import { getSettings, saveSettings } from "../db.js";
import { broadcast } from "../ws-hub.js";

export async function settingsRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    reply.send(getSettings());
  });

  fastify.put("/", async (request, reply) => {
    const settings = saveSettings(settingsSchema.parse(request.body));
    broadcast({ type: "settings:changed", settings });
    reply.send(settings);
  });
}
