import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForToken } from "@/lib/pos/connectors/poster";
import { saveAccount } from "@/lib/db/repositories/accounts";
import { saveUser } from "@/lib/db/repositories/users";

const STATE_COOKIE = "poster_oauth_state";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state");

  if (error) {
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/?error=missing_code", request.url)
    );
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (!state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL("/?error=invalid_oauth_state", request.url)
    );
  }

  const applicationId = process.env.POSTER_APPLICATION_ID;
  const applicationSecret = process.env.POSTER_APPLICATION_SECRET;
  const redirectUri = process.env.POSTER_REDIRECT_URI ?? new URL("/api/auth/poster/callback", request.url).toString();

  if (!applicationId || !applicationSecret) {
    return NextResponse.redirect(
      new URL("/?error=missing_config", request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await exchangeCodeForToken(
      code,
      applicationId,
      applicationSecret,
      redirectUri
    );

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

    return NextResponse.redirect(
      new URL(`/?connected=true&account=${tokenResponse.account_number}`, request.url)
    );
  } catch (err) {
    console.error("Poster OAuth callback error:", err);
    return NextResponse.redirect(
      new URL(`/?error=oauth_failed`, request.url)
    );
  }
}
