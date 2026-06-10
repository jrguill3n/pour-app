import { describe, expect, it } from "vitest";
import { validatePosterOAuthState } from "./oauth-state";

describe("Poster OAuth state validation", () => {
  const baseInput = {
    queryState: "state-query",
    cookieState: "state-query",
    code: "code-present",
    account: "account-present",
    appUrl: "https://pour.example",
    posterRedirectUri: "https://pour.example/api/auth/poster/callback",
  };

  it("accepts exact query and cookie state matches", () => {
    const validation = validatePosterOAuthState(baseInput);

    expect(validation.valid).toBe(true);
    expect(validation.diagnostics).toMatchObject({
      hasStateQuery: true,
      hasStateCookie: true,
      statesMatch: true,
      usedMissingStateFallback: false,
      hasCode: true,
      hasAccount: true,
    });
  });

  it("rejects mismatched query and cookie states even when code and account exist", () => {
    const validation = validatePosterOAuthState({
      ...baseInput,
      queryState: "poster-state",
      cookieState: "cookie-state",
    });

    expect(validation.valid).toBe(false);
    expect(validation.diagnostics).toMatchObject({
      hasStateQuery: true,
      hasStateCookie: true,
      statesMatch: false,
      usedMissingStateFallback: false,
    });
  });

  it("accepts missing query state only with cookie, code, and account", () => {
    const validation = validatePosterOAuthState({
      ...baseInput,
      queryState: null,
      cookieState: "cookie-state",
    });

    expect(validation.valid).toBe(true);
    expect(validation.diagnostics).toMatchObject({
      hasStateQuery: false,
      hasStateCookie: true,
      statesMatch: false,
      usedMissingStateFallback: true,
      hasCode: true,
      hasAccount: true,
    });
  });

  it("rejects missing query state when code or account is absent", () => {
    expect(validatePosterOAuthState({ ...baseInput, queryState: null, code: null }).valid).toBe(false);
    expect(validatePosterOAuthState({ ...baseInput, queryState: null, account: null }).valid).toBe(false);
  });

  it("rejects callbacks without the state cookie", () => {
    expect(validatePosterOAuthState({ ...baseInput, cookieState: undefined }).valid).toBe(false);
    expect(validatePosterOAuthState({ ...baseInput, queryState: null, cookieState: undefined }).valid).toBe(false);
  });
});
