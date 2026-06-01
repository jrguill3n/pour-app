import { NextRequest, NextResponse } from "next/server";
import { syncPosterCatalog } from "@/lib/pos/sync/poster";

function isManualSyncAllowed(request: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  const expectedSecret = process.env.DEV_SYNC_SECRET;
  const actualSecret = request.headers.get("x-dev-sync-secret") ?? request.nextUrl.searchParams.get("secret");

  return Boolean(expectedSecret && actualSecret && expectedSecret === actualSecret);
}

async function handleManualSync(request: NextRequest) {
  if (!isManualSyncAllowed(request)) {
    return NextResponse.json({ error: "Manual sync is not enabled." }, { status: 403 });
  }

  let posAccountId = request.nextUrl.searchParams.get("pos_account_id") ?? undefined;

  if (request.method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { pos_account_id?: string } | null;
    posAccountId = body?.pos_account_id ?? posAccountId;
  }

  try {
    const result = await syncPosterCatalog({ posAccountId });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Poster manual sync failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Manual sync failed." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleManualSync(request);
}

export async function POST(request: NextRequest) {
  return handleManualSync(request);
}
