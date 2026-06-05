import { NextRequest, NextResponse } from "next/server";
import { runDueAutoSync } from "@/lib/pos/sync/scheduler";
import { isProtectedRouteAllowed } from "@/lib/security/admin";

function isCronAllowed(request: NextRequest): boolean {
  return isProtectedRouteAllowed(request, "cron");
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
