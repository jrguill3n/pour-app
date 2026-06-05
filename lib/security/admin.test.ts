import { afterEach, describe, expect, it, vi } from "vitest";
import { hasSharedSecret, isProtectedRouteAllowed, isSameOriginRequest } from "./admin";

function request(headers: Record<string, string>, url = "https://pour.example/api/ops/sync") {
  return {
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
    nextUrl: new URL(url),
  } as never;
}

describe("protected route helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts matching shared secrets without exposing secret values", () => {
    expect(hasSharedSecret(request({ "x-pour-admin-secret": "known" }), ["known"])).toBe(true);
    expect(hasSharedSecret(request({ "x-pour-admin-secret": "wrong" }), ["known"])).toBe(false);
  });

  it("detects same-origin browser requests", () => {
    expect(isSameOriginRequest(request({ origin: "https://pour.example", host: "pour.example" }))).toBe(true);
    expect(isSameOriginRequest(request({ origin: "https://evil.example", host: "pour.example" }))).toBe(false);
  });

  it("allows production ops requests from same-origin UI", () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(isProtectedRouteAllowed(request({ origin: "https://pour.example", host: "pour.example" }), "ops")).toBe(true);
  });
});
