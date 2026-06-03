import { describe, expect, it } from "vitest";
import { chooseContext, DEMO_CONTEXT, hasRealConnectedAccount } from "./operations-boundary";

describe("operational demo/real boundary", () => {
  const demoAccount = {
    merchantId: "mock-merchant",
    posProvider: "mock",
  };
  const posterAccount = {
    merchantId: "624548",
    posProvider: "poster",
  };

  it("uses demo context only when no account exists", () => {
    expect(chooseContext([])).toEqual(DEMO_CONTEXT);
  });

  it("prefers a real POS account over seeded demo data", () => {
    expect(chooseContext([demoAccount, posterAccount])).toEqual({
      merchantId: "624548",
      posProvider: "poster",
    });
  });

  it("allows explicit demo mode when requested", () => {
    expect(chooseContext([demoAccount, posterAccount], "mock")).toEqual(DEMO_CONTEXT);
  });

  it("detects connected real accounts separately from mock demo accounts", () => {
    expect(hasRealConnectedAccount([demoAccount])).toBe(false);
    expect(hasRealConnectedAccount([demoAccount, posterAccount])).toBe(true);
  });
});
