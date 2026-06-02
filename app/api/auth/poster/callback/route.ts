import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  PosterOAuthExchangeError,
  exchangeCodeForTokenWithDebug,
} from "@/lib/pos/connectors/poster";
import { saveAccount } from "@/lib/db/repositories/accounts";
import { saveUser } from "@/lib/db/repositories/users";

const STATE_COOKIE = "poster_oauth_state";

function shouldUseSecureCookie(request: Request): boolean {
  const appUrl = process.env.APP_URL;

  if (appUrl?.startsWith("http://localhost")) {
    return false;
  }

  if (appUrl?.startsWith("https://")) {
    return true;
  }

  return new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production";
}

function canUseLocalhostStateFallback(): boolean {
  return Boolean(process.env.APP_URL?.startsWith("http://localhost"));
}

function redirectAndClearState(request: Request, pathnameAndQuery: string) {
  const response = NextResponse.redirect(new URL(pathnameAndQuery, request.url));

  response.cookies.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    maxAge: 0,
    path: "/",
  });

  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const account = searchParams.get("account");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    return redirectAndClearState(request, `/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.warn("Poster OAuth callback missing code.", {
      hasState: Boolean(state),
    });
    return redirectAndClearState(request, "/?error=missing_code");
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const usedLocalhostStateFallback = Boolean(
    !state && expectedState && canUseLocalhostStateFallback()
  );
  const statesMatch = Boolean(
    (state && expectedState && state === expectedState) || usedLocalhostStateFallback
  );
  const stateDiagnostics = {
    hasStateQuery: Boolean(state),
    hasStateCookie: Boolean(expectedState),
    statesMatch,
    usedLocalhostStateFallback,
    APP_URL: process.env.APP_URL ?? null,
    POSTER_REDIRECT_URI: process.env.POSTER_REDIRECT_URI ?? null,
  };

  console.info("Poster OAuth callback state diagnostics.", stateDiagnostics);

  if (!expectedState || !statesMatch) {
    console.warn("Poster OAuth state validation failed.", stateDiagnostics);
    return redirectAndClearState(request, "/?error=invalid_oauth_state");
  }

  const applicationId = process.env.POSTER_APPLICATION_ID;
  const applicationSecret = process.env.POSTER_APPLICATION_SECRET;
  const redirectUri = process.env.POSTER_REDIRECT_URI ?? new URL("/api/auth/poster/callback", request.url).toString();
  const tokenExchangePayloadDiagnostics = {
    hasCode: Boolean(code),
    hasPosterApplicationId: Boolean(applicationId),
    hasPosterApplicationSecret: Boolean(applicationSecret),
    POSTER_REDIRECT_URI: redirectUri,
    tokenUrl: account ? `https://${account}.joinposter.com/api/v2/auth/access_token` : null,
    requestContentType: "multipart/form-data",
    payloadKeys: [
      "application_id",
      "application_secret",
      "grant_type",
      "redirect_uri",
      "code",
    ],
    grantType: "authorization_code",
    hasAccount: Boolean(account),
    account,
  };

  console.info("Poster OAuth token exchange payload diagnostics.", tokenExchangePayloadDiagnostics);

  if (!applicationId || !applicationSecret) {
    return redirectAndClearState(request, "/?error=missing_config");
  }

  if (!account) {
    console.warn("Poster OAuth callback missing account.", tokenExchangePayloadDiagnostics);
    return redirectAndClearState(request, "/?error=oauth_failed");
  }

  try {
    console.info("Poster OAuth token exchange starting.", {
      hasCode: Boolean(code),
      hasPosterApplicationId: Boolean(applicationId),
      hasPosterApplicationSecret: Boolean(applicationSecret),
      POSTER_REDIRECT_URI: redirectUri,
      tokenUrl: tokenExchangePayloadDiagnostics.tokenUrl,
      requestContentType: tokenExchangePayloadDiagnostics.requestContentType,
      payloadKeys: tokenExchangePayloadDiagnostics.payloadKeys,
      hasAccount: Boolean(account),
      account,
    });

    // Exchange code for access token
    const { tokenResponse, debug } = await exchangeCodeForTokenWithDebug(
      code,
      account,
      applicationId,
      applicationSecret,
      redirectUri
    );

    console.info("Poster OAuth token exchange response.", {
      hasCode: Boolean(code),
      tokenUrl: debug.tokenUrl,
      requestContentType: debug.requestContentType,
      payloadKeys: debug.payloadKeys,
      hasAccount: debug.hasAccount,
      account: debug.account,
      tokenExchangeStatus: debug.status,
      responseBodyKeys: debug.bodyKeys,
      apiErrorMessage: debug.apiErrorMessage,
      posterErrorResponseBody: debug.sanitizedBody,
    });

    const user = await saveUser({
      email: tokenResponse.user.email,
      name: tokenResponse.user.name,
      raw: tokenResponse.user,
    });

    const tokenExpiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    await saveAccount({
      userId: user.id,
      merchantId: tokenResponse.account_number,
      posProvider: "poster",
      posAccountId: tokenResponse.account_number,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      tokenExpiresAt,
      raw: tokenResponse,
    });

    return redirectAndClearState(
      request,
      `/?connected=true&account=${tokenResponse.account_number}`
    );
  } catch (err) {
    if (err instanceof PosterOAuthExchangeError) {
      console.warn("Poster OAuth token exchange failed.", {
        hasCode: Boolean(code),
        hasPosterApplicationId: Boolean(applicationId),
        hasPosterApplicationSecret: Boolean(applicationSecret),
        POSTER_REDIRECT_URI: redirectUri,
        tokenUrl: err.tokenUrl,
        requestContentType: err.requestContentType,
        payloadKeys: err.payloadKeys,
        hasAccount: err.hasAccount,
        account: err.account,
        tokenExchangeStatus: err.status,
        responseBodyKeys: err.bodyKeys,
        apiErrorMessage: err.apiErrorMessage,
        posterErrorResponseBody: err.sanitizedBody,
      });
    } else {
      console.error("Poster OAuth callback failed after token exchange.", {
        hasCode: Boolean(code),
        errorName: err instanceof Error ? err.name : "UnknownError",
        apiErrorMessage: err instanceof Error ? err.message : "Unknown error",
      });
    }
    return redirectAndClearState(request, "/?error=oauth_failed");
  }
}
