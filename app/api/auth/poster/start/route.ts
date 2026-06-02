import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getOAuthUrl } from "@/lib/pos/connectors/poster";

const STATE_COOKIE = "poster_oauth_state";

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
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
  });

  return NextResponse.redirect(oauthUrl);
}
