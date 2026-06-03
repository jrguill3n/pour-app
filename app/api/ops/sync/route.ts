import { NextRequest, NextResponse } from "next/server";
import {
  appendSyncFailureLog,
  getOperationalSnapshot,
  markDemoSync,
} from "@/lib/db/repositories/operations";
import { updateAccountSyncStatus } from "@/lib/db/repositories/accounts";
import { syncPosterManual } from "@/lib/pos/sync/poster";
import { nextSyncAt } from "@/lib/pos/sync/scheduler-boundary";
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
      const syncedAt = new Date();
      const account = snapshot.accounts.find((item) => item.posProvider === provider && item.posAccountId === result.posAccountId);
      await updateAccountSyncStatus({
        posProvider: provider,
        posAccountId: result.posAccountId,
        lastSyncStatus: "success",
        lastSyncAt: syncedAt,
        nextSyncAt: nextSyncAt(syncedAt, account?.syncIntervalMinutes),
        lastSyncError: null,
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
    if (provider === "poster" && body?.pos_account_id) {
      const failedAt = new Date();
      const account = snapshot.accounts.find((item) => item.posProvider === provider && item.posAccountId === body.pos_account_id);
      await updateAccountSyncStatus({
        posProvider: provider,
        posAccountId: body.pos_account_id,
        lastSyncStatus: "error",
        lastSyncAt: failedAt,
        nextSyncAt: nextSyncAt(failedAt, account?.syncIntervalMinutes),
        lastSyncError: message,
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
