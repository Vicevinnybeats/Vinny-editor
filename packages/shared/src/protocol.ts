import { z } from "zod";
import { settingsSchema } from "./settings.js";

/**
 * Every client (phone, desktop, ...) connects over this WS protocol and treats
 * the server as the single source of truth: on connect it receives a full
 * state snapshot, then a stream of deltas. There is no client-owned state to
 * reconcile - a reconnect is just "ask for the snapshot again".
 */

export const stateSnapshotSchema = z.object({
  type: z.literal("state:snapshot"),
  settings: settingsSchema,
  serverTime: z.string(),
});
export type StateSnapshot = z.infer<typeof stateSnapshotSchema>;

export const clientHelloSchema = z.object({
  type: z.literal("client:hello"),
  clientId: z.string(),
});
export type ClientHello = z.infer<typeof clientHelloSchema>;

export const pingSchema = z.object({ type: z.literal("ping") });
export const pongSchema = z.object({ type: z.literal("pong") });

export const serverMessageSchema = z.discriminatedUnion("type", [stateSnapshotSchema, pongSchema]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const clientMessageSchema = z.discriminatedUnion("type", [clientHelloSchema, pingSchema]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
