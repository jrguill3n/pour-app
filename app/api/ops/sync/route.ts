import { NextRequest, NextResponse } from "next/server";
import {
  appendSyncFailureLog,
  getOperationalSnapshot,
  markDemoSync,
} from "@/lib/db/repositories/operations";
import { syncPosterManual } from "@/lib/pos/sync/poster";
import type { POSProvider } from "@/lib/pos/types";

interface SyncPayload {
  provider?: POSProvider;
  pos_account_id?: string;
  from?: string;
  to?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as SyncPayload | null;
  const snapshot = await getOperationalSnapshot(body?.provider);
  const provider = body?.provider ?? snapshot.context.posProvider;

  try {
    if (provider === "poster") {
      const result = await syncPosterManual({
        posAccountId: body?.pos_account_id,
        from: body?.from,
        to: body?.to,
      });
      const nextSnapshot = await getOperationalSnapshot(provider);
      return NextResponse.json({ ok: true, result, snapshot: nextSnapshot });
    }

    await markDemoSync(snapshot.context);
    const nextSnapshot = await getOperationalSnapshot(provider);
    return NextResponse.json({
      ok: true,
      result: {
        mode: "demo",
        message: "Demo mode is already seeded; no external POS sync was run.",
      },
      snapshot: nextSnapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual sync failed.";
    await appendSyncFailureLog(snapshot.context, "manual-sync", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
