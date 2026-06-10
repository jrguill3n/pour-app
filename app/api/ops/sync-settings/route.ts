import { NextRequest, NextResponse } from "next/server";
import { updateAccountAutoSyncSettings } from "@/lib/db/repositories/accounts";
import { getOperationalSnapshot } from "@/lib/db/repositories/operations";
import type { POSProvider } from "@/lib/pos/types";

interface SyncSettingsPayload {
  pos_provider?: POSProvider;
  pos_account_id?: string;
  auto_sync_enabled?: boolean;
  sync_interval_minutes?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as SyncSettingsPayload | null;
  const snapshot = await getOperationalSnapshot(body?.pos_provider);
  const account = body?.pos_account_id
    ? snapshot.accounts.find((item) => item.posAccountId === body.pos_account_id && item.posProvider === snapshot.context.posProvider)
    : snapshot.accounts.find((item) => item.posProvider === snapshot.context.posProvider);

  if (!account) {
    return NextResponse.json({ ok: false, error: "Connected POS account not found." }, { status: 404 });
  }

  await updateAccountAutoSyncSettings({
    posProvider: account.posProvider as POSProvider,
    posAccountId: account.posAccountId,
    autoSyncEnabled: body?.auto_sync_enabled ?? account.autoSyncEnabled,
    syncIntervalMinutes: body?.sync_interval_minutes ?? account.syncIntervalMinutes,
  });

  const nextSnapshot = await getOperationalSnapshot(account.posProvider as POSProvider);
  return NextResponse.json({ ok: true, snapshot: nextSnapshot });
}
