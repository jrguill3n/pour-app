import { NextRequest, NextResponse } from "next/server";
import {
  appendSyncFailureLog,
  getOperationalSnapshot,
  markDemoSync,
} from "@/lib/db/repositories/operations";
import { updateAccountSyncStatus } from "@/lib/db/repositories/accounts";
import { runManualPosSync } from "@/lib/pos/sync/manual";
import { nextSyncAt } from "@/lib/pos/sync/scheduler-boundary";
import { isProtectedRouteAllowed } from "@/lib/security/admin";
import type { POSProvider } from "@/lib/pos/types";

interface SyncPayload {
  provider?: POSProvider;
  pos_account_id?: string;
  from?: string;
  to?: string;
}

async function readPayload(request: NextRequest): Promise<SyncPayload> {
  const queryPayload = {
    provider: request.nextUrl.searchParams.get("provider") as POSProvider | null,
    pos_account_id: request.nextUrl.searchParams.get("pos_account_id"),
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  };

  if (request.method !== "POST" || !request.headers.get("content-type")?.includes("application/json")) {
    return {
      provider: queryPayload.provider ?? undefined,
      pos_account_id: queryPayload.pos_account_id ?? undefined,
      from: queryPayload.from ?? undefined,
      to: queryPayload.to ?? undefined,
    };
  }

  const body = (await request.json().catch(() => null)) as SyncPayload | null;

  return {
    provider: body?.provider ?? queryPayload.provider ?? undefined,
    pos_account_id: body?.pos_account_id ?? queryPayload.pos_account_id ?? undefined,
    from: body?.from ?? queryPayload.from ?? undefined,
    to: body?.to ?? queryPayload.to ?? undefined,
  };
}

async function handleOpsSync(request: NextRequest) {
  if (!isProtectedRouteAllowed(request, "ops")) {
    return NextResponse.json({ ok: false, error: "Manual sync is not authorized." }, { status: 403 });
  }

  const body = await readPayload(request);
  const snapshot = await getOperationalSnapshot(body?.provider);
  const connectedAccount = snapshot.accounts.find((item) => item.connected && item.posProvider !== "mock");
  const provider = body?.provider ?? (connectedAccount?.posProvider as POSProvider | undefined) ?? snapshot.context.posProvider;
  const posAccountId = body?.pos_account_id ?? connectedAccount?.posAccountId;

  try {
    if (provider === "poster") {
      const result = await runManualPosSync({
        provider: "poster",
        posAccountId,
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

    const result = await runManualPosSync({ provider, from: body?.from, to: body?.to });
    await markDemoSync(snapshot.context);
    const nextSnapshot = await getOperationalSnapshot(provider);
    return NextResponse.json({
      ok: true,
      result,
      snapshot: nextSnapshot,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Manual sync failed.";
    await appendSyncFailureLog(snapshot.context, "manual-sync", message);
    if (provider === "poster" && posAccountId) {
      const failedAt = new Date();
      const account = snapshot.accounts.find((item) => item.posProvider === provider && item.posAccountId === posAccountId);
      await updateAccountSyncStatus({
        posProvider: provider,
        posAccountId,
        lastSyncStatus: "error",
        lastSyncAt: failedAt,
        nextSyncAt: nextSyncAt(failedAt, account?.syncIntervalMinutes),
        lastSyncError: message,
      });
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleOpsSync(request);
}

export async function POST(request: NextRequest) {
  return handleOpsSync(request);
}
