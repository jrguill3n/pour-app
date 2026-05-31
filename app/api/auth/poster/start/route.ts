import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/pos/connectors/poster";

export async function GET() {
  const applicationId = process.env.POSTER_APPLICATION_ID;
  const redirectUri = process.env.POSTER_REDIRECT_URI;

  if (!applicationId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing Poster configuration" },
      { status: 500 }
    );
  }

  // Generate a state parameter for CSRF protection
  const state = crypto.randomUUID();
  
  // In production, store state in a secure cookie or session
  const oauthUrl = getOAuthUrl(applicationId, redirectUri, state);

  return NextResponse.redirect(oauthUrl);
}
