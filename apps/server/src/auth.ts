import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { env } from "./env.js";

const COOKIE_NAME = "vinny_session";
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sign(payload: string): string {
  return createHmac("sha256", env.SESSION_SECRET).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;

  const expected = sign(payload);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const { iat } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      iat: number;
    };
    return Date.now() - iat < SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

export function passphraseMatches(candidate: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(env.AUTH_PASSPHRASE).digest();
  return timingSafeEqual(a, b);
}

export function setSessionCookie(reply: FastifyReply) {
  reply.setCookie(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function isRequestAuthed(request: FastifyRequest): boolean {
  return verifySessionToken(request.cookies[COOKIE_NAME]);
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isRequestAuthed(request)) {
    reply.code(401).send({ error: "unauthorized" });
  }
}
