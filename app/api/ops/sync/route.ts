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

function syncErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Manual sync failed.";
  return message.length > 500 ? `${message.slice(0, 500)}...` : message;
}

function syncFailureResponse(error: unknown, phase: string) {
  const message = syncErrorMessage(error);

  console.error("Ops sync failed.", {
    syncPhase: phase,
    statusCode: 500,
    sanitizedErrorMessage: message,
  });

  return NextResponse.json({ ok: false, error: message }, { status: 500 });
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
  let phase = "route-protection";
  let provider: POSProvider | undefined;
  let posAccountId: string | undefined;
  let snapshot: Awaited<ReturnType<typeof getOperationalSnapshot>> | null = null;

  try {
    if (!isProtectedRouteAllowed(request, "ops")) {
      return NextResponse.json({ ok: false, error: "Manual sync is not authorized." }, { status: 403 });
    }

    phase = "read-payload";
    const body = await readPayload(request);

    phase = "account-lookup";
    snapshot = await getOperationalSnapshot(body?.provider);
    const connectedAccount = snapshot.accounts.find((item) => item.connected && item.posProvider !== "mock");
    provider = body?.provider ?? (connectedAccount?.posProvider as POSProvider | undefined) ?? snapshot.context.posProvider;
    posAccountId = body?.pos_account_id ?? connectedAccount?.posAccountId;

    console.info("Ops sync starting.", {
      merchantId: snapshot.context.merchantId,
      posProvider: provider,
      syncPhase: phase,
    });

    if (provider === "poster") {
      phase = "poster-manual-sync";
      const result = await runManualPosSync({
        provider: "poster",
        posAccountId,
        from: body?.from,
        to: body?.to,
      });
      const syncedAt = new Date();
      const account = snapshot.accounts.find((item) => item.posProvider === provider && item.posAccountId === result.posAccountId);

      phase = "sync-status-update";
      await updateAccountSyncStatus({
        posProvider: provider,
        posAccountId: result.posAccountId,
        lastSyncStatus: "success",
        lastSyncAt: syncedAt,
        nextSyncAt: nextSyncAt(syncedAt, account?.syncIntervalMinutes),
        lastSyncError: null,
      });

      phase = "status-refresh";
      const nextSnapshot = await getOperationalSnapshot(provider);

      console.info("Ops sync completed.", {
        merchantId: result.merchantId,
        posProvider: provider,
        syncPhase: phase,
        statusCode: 200,
      });

      return NextResponse.json({ ok: true, result, snapshot: nextSnapshot });
    }

    phase = "demo-sync";
    const result = await runManualPosSync({ provider, from: body?.from, to: body?.to });
    await markDemoSync(snapshot.context);

    phase = "status-refresh";
    const nextSnapshot = await getOperationalSnapshot(provider);
    return NextResponse.json({
      ok: true,
      result,
      snapshot: nextSnapshot,
    });
  } catch (error) {
    const message = syncErrorMessage(error);
    const context = snapshot?.context;

    console.error("Ops sync failed.", {
      merchantId: context?.merchantId ?? null,
      posProvider: provider ?? context?.posProvider ?? null,
      syncPhase: phase,
      statusCode: 500,
      sanitizedErrorMessage: message,
    });

    if (context) {
      await appendSyncFailureLog(context, "manual-sync", message).catch((logError) => {
        console.error("Ops sync failure log write failed.", {
          merchantId: context.merchantId,
          posProvider: context.posProvider,
          syncPhase: "failure-log",
          statusCode: 500,
          sanitizedErrorMessage: syncErrorMessage(logError),
        });
      });
    }

    if (provider === "poster" && posAccountId && snapshot) {
      const failedAt = new Date();
      const account = snapshot.accounts.find((item) => item.posProvider === provider && item.posAccountId === posAccountId);
      await updateAccountSyncStatus({
        posProvider: provider,
        posAccountId,
        lastSyncStatus: "error",
        lastSyncAt: failedAt,
        nextSyncAt: nextSyncAt(failedAt, account?.syncIntervalMinutes),
        lastSyncError: message,
      }).catch((statusError) => {
        console.error("Ops sync status update failed.", {
          merchantId: context?.merchantId ?? null,
          posProvider: provider,
          syncPhase: "sync-status-update",
          statusCode: 500,
          sanitizedErrorMessage: syncErrorMessage(statusError),
        });
      });
    }

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleOpsSync(request).catch((error) => syncFailureResponse(error, "unhandled-get"));
}

export async function POST(request: NextRequest) {
  return handleOpsSync(request).catch((error) => syncFailureResponse(error, "unhandled-post"));
}
