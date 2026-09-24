import { z } from "zod";
import { settingsSchema } from "./settings.js";
import { tabSchema } from "./tabs.js";
import { chatMessageSchema } from "./chat.js";

/**
 * Every client (phone, desktop, ...) connects over this WS protocol and treats
 * the server as the single source of truth: on connect it receives a full
 * state snapshot, then a stream of deltas. There is no client-owned state to
 * reconcile - a reconnect is just "ask for the snapshot again".
 *
 * File contents, git status, and search are plain REST (apps/server/src/routes)
 * since they're request/response, not state that needs to be pushed. The WS
 * channel carries only what genuinely needs to be live: settings/tab/chat
 * broadcasts, chat streaming, and the shared terminal.
 */

export const stateSnapshotSchema = z.object({
  type: z.literal("state:snapshot"),
  settings: settingsSchema,
  tabs: z.array(tabSchema),
  chatHistory: z.array(chatMessageSchema),
  terminalBuffer: z.string(),
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

export const terminalInputSchema = z.object({
  type: z.literal("terminal:input"),
  data: z.string(),
});
export const terminalResizeSchema = z.object({
  type: z.literal("terminal:resize"),
  cols: z.number().int().positive(),
  rows: z.number().int().positive(),
});
export const terminalOutputSchema = z.object({
  type: z.literal("terminal:output"),
  data: z.string(),
});

export const settingsChangedSchema = z.object({
  type: z.literal("settings:changed"),
  settings: settingsSchema,
});
export const tabsChangedSchema = z.object({
  type: z.literal("tabs:changed"),
  tabs: z.array(tabSchema),
});
export const fsChangedSchema = z.object({
  type: z.literal("fs:changed"),
  path: z.string(),
});
export const chatMessageEventSchema = z.object({
  type: z.literal("chat:message"),
  message: chatMessageSchema,
});
export const chatDeltaSchema = z.object({
  type: z.literal("chat:delta"),
  id: z.string(),
  delta: z.string(),
});
export const chatDoneSchema = z.object({
  type: z.literal("chat:done"),
  id: z.string(),
});
export const chatErrorSchema = z.object({
  type: z.literal("chat:error"),
  id: z.string(),
  message: z.string(),
});

export const serverMessageSchema = z.discriminatedUnion("type", [
  stateSnapshotSchema,
  pongSchema,
  terminalOutputSchema,
  settingsChangedSchema,
  tabsChangedSchema,
  fsChangedSchema,
  chatMessageEventSchema,
  chatDeltaSchema,
  chatDoneSchema,
  chatErrorSchema,
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientHelloSchema,
  pingSchema,
  terminalInputSchema,
  terminalResizeSchema,
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
