import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/pos/connectors/poster";

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

export async function GET(request: Request) {
  const applicationId = process.env.POSTER_APPLICATION_ID;
  const redirectUri = process.env.POSTER_REDIRECT_URI ?? new URL("/api/auth/poster/callback", request.url).toString();

  if (!applicationId) {
    return NextResponse.json(
      { error: "Missing Poster configuration" },
      { status: 500 }
    );
  }

  const state = crypto.randomUUID();
  const oauthUrl = getOAuthUrl(applicationId, redirectUri, state);
  const parsedOAuthUrl = new URL(oauthUrl);
  const response = NextResponse.redirect(oauthUrl);

  console.info("Poster OAuth start.", {
    oauthUrlHasState: parsedOAuthUrl.searchParams.has("state"),
    APP_URL: process.env.APP_URL ?? null,
    POSTER_REDIRECT_URI: process.env.POSTER_REDIRECT_URI ?? null,
  });

  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: shouldUseSecureCookie(request),
    maxAge: 60 * 10,
    path: "/",
  });

  return response;
}
