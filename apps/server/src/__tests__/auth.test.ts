import { describe, expect, it } from "vitest";
import { createSessionToken, passphraseMatches, verifySessionToken } from "../auth.js";

describe("session tokens", () => {
  it("verifies a freshly created token", () => {
    expect(verifySessionToken(createSessionToken())).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(verifySessionToken(undefined)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-real-token")).toBe(false);
  });

  it("rejects a token with a tampered payload", () => {
    const token = createSessionToken();
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ iat: Date.now() + 1e9 })).toString(
      "base64url",
    );
    expect(verifySessionToken(`${forgedPayload}.${sig}`)).toBe(false);
  });

  it("rejects a token with a tampered signature", () => {
    const token = createSessionToken();
    const [payload] = token.split(".");
    expect(verifySessionToken(`${payload}.deadbeef`)).toBe(false);
  });
});

describe("passphraseMatches", () => {
  it("matches the configured passphrase", () => {
    expect(passphraseMatches("test-passphrase")).toBe(true);
  });

  it("rejects an incorrect passphrase", () => {
    expect(passphraseMatches("wrong")).toBe(false);
  });

  it("rejects an empty passphrase", () => {
    expect(passphraseMatches("")).toBe(false);
  });
});
