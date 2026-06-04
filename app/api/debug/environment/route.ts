import { NextResponse } from "next/server";
import { getDatabase, getDatabaseDialect } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import { buildEnvironmentDebugSummary, isEnvironmentDebugEnabled } from "@/lib/debug/environment";

function commitSha() {
  return process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    process.env.COMMIT_SHA ??
    null;
}

export async function GET() {
  const enabled = isEnvironmentDebugEnabled();

  if (!enabled) {
    return NextResponse.json({ ok: false, enabled: false }, { status: 404 });
  }

  const dialect = getDatabaseDialect();
  let connectedMerchantCount = 0;
  let databaseReachable = true;
  let databaseError: string | null = null;

  try {
    const runtime = getDatabase();
    const accountRows = runtime.dialect === "postgres"
      ? await runtime.db.select().from(pg.accounts)
      : await runtime.db.select().from(sqlite.accounts);
    connectedMerchantCount = new Set(
      accountRows
        .filter((account) => account.posProvider !== "mock" && Boolean(account.accessToken))
        .map((account) => account.merchantId)
    ).size;
  } catch (error) {
    console.warn("Environment debug database check failed.", {
      message: error instanceof Error ? error.message : "Unknown database error",
    });
    databaseReachable = false;
    databaseError = "Database unavailable";
  }

  const summary = buildEnvironmentDebugSummary({
    commitSha: commitSha(),
    databaseDialect: dialect,
    connectedMerchantCount,
    demoMode: connectedMerchantCount === 0,
    databaseReachable,
    databaseError,
    enabled,
    envPresence: {
      databaseUrl: Boolean(process.env.DATABASE_URL),
      posterApplicationId: Boolean(process.env.POSTER_APPLICATION_ID),
      posterApplicationSecret: Boolean(process.env.POSTER_APPLICATION_SECRET),
      posterRedirectUri: Boolean(process.env.POSTER_REDIRECT_URI),
      appUrl: Boolean(process.env.APP_URL),
    },
  });

  return NextResponse.json({ ok: true, debug: summary });
}
