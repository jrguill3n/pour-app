export interface PosterOAuthStateValidationInput {
  queryState: string | null;
  cookieState: string | undefined;
  code: string | null;
  account: string | null;
  appUrl: string | undefined;
  posterRedirectUri: string | undefined;
}

export interface PosterOAuthStateDiagnostics {
  hasStateQuery: boolean;
  hasStateCookie: boolean;
  statesMatch: boolean;
  usedMissingStateFallback: boolean;
  hasCode: boolean;
  hasAccount: boolean;
  APP_URL: string | null;
  POSTER_REDIRECT_URI: string | null;
}

export interface PosterOAuthStateValidation {
  valid: boolean;
  diagnostics: PosterOAuthStateDiagnostics;
}

export function validatePosterOAuthState(input: PosterOAuthStateValidationInput): PosterOAuthStateValidation {
  const hasStateQuery = Boolean(input.queryState);
  const hasStateCookie = Boolean(input.cookieState);
  const hasCode = Boolean(input.code);
  const hasAccount = Boolean(input.account);
  const statesMatch = Boolean(
    input.queryState && input.cookieState && input.queryState === input.cookieState
  );

  // Poster may omit the state query param. This fallback is only valid while
  // the short-lived, httpOnly state cookie from our own /start flow still exists.
  const usedMissingStateFallback = Boolean(
    !input.queryState && input.cookieState && hasCode && hasAccount
  );

  return {
    valid: Boolean(input.cookieState && (statesMatch || usedMissingStateFallback)),
    diagnostics: {
      hasStateQuery,
      hasStateCookie,
      statesMatch,
      usedMissingStateFallback,
      hasCode,
      hasAccount,
      APP_URL: input.appUrl ?? null,
      POSTER_REDIRECT_URI: input.posterRedirectUri ?? null,
    },
  };
}
