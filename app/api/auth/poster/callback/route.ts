import { NextResponse } from "next/server";
import { exchangeCodeForToken } from "@/lib/poster-api";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

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

  const applicationId = process.env.POSTER_APPLICATION_ID;
  const applicationSecret = process.env.POSTER_APPLICATION_SECRET;
  const redirectUri = process.env.POSTER_REDIRECT_URI;

  if (!applicationId || !applicationSecret || !redirectUri) {
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

    // Create or get user (using email from Poster)
    const email = tokenResponse.user.email;
    const existingUser = await sql`
      SELECT id FROM public.users WHERE email = ${email}
    `;

    let userId: string;
    if (existingUser.length === 0) {
      const newUser = await sql`
        INSERT INTO public.users (email)
        VALUES (${email})
        RETURNING id
      `;
      userId = newUser[0].id;
    } else {
      userId = existingUser[0].id;
    }

    // Upsert account with Poster credentials
    await sql`
      INSERT INTO public.accounts (user_id, poster_account_id, access_token)
      VALUES (${userId}, ${tokenResponse.account_number}, ${tokenResponse.access_token})
      ON CONFLICT (poster_account_id) 
      DO UPDATE SET 
        access_token = ${tokenResponse.access_token},
        updated_at = CURRENT_TIMESTAMP
    `;

    // Redirect to app with success
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
