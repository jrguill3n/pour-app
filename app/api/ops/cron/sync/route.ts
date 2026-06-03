import { NextRequest, NextResponse } from "next/server";
import { runDueAutoSync } from "@/lib/pos/sync/scheduler";

function isCronAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expectedSecret = process.env.SYNC_CRON_SECRET;
  const actualSecret =
    request.headers.get("x-sync-cron-secret") ??
    request.nextUrl.searchParams.get("secret");

  return Boolean(expectedSecret && actualSecret && expectedSecret === actualSecret);
}

async function handleCronSync(request: NextRequest) {
  if (!isCronAllowed(request)) {
    return NextResponse.json({ ok: false, error: "Auto sync cron is not authorized." }, { status: 403 });
  }

  const result = await runDueAutoSync();
  return NextResponse.json({ ok: true, result });
}

export async function GET(request: NextRequest) {
  return handleCronSync(request);
}

export async function POST(request: NextRequest) {
  return handleCronSync(request);
}
