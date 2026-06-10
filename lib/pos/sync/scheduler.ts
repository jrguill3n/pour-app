import {
  getConnectedAccountsForAutoSync,
  updateAccountSyncStatus,
  type POSAccountRecord,
} from "@/lib/db/repositories/accounts";
import { appendSyncFailureLog } from "@/lib/db/repositories/operations";
import { runManualPosSync } from "@/lib/pos/sync/manual";
import type { POSProvider } from "@/lib/pos/types";
import {
  InMemorySyncLock,
  nextSyncAt,
  shouldRunAutoSync,
} from "./scheduler-boundary";

const syncLock = new InMemorySyncLock();

export interface AutoSyncRunResult {
  checked: number;
  synced: number;
  skipped: number;
  errors: Array<{ account: string; error: string }>;
}

function accountKey(account: Pick<POSAccountRecord, "posProvider" | "posAccountId">): string {
  return `${account.posProvider}:${account.posAccountId}`;
}

async function syncAccount(account: POSAccountRecord) {
  return runManualPosSync({
    provider: account.posProvider as POSProvider,
    posAccountId: account.posAccountId,
  });
}

export async function runDueAutoSync(now = new Date()): Promise<AutoSyncRunResult> {
  const accounts = await getConnectedAccountsForAutoSync();
  const result: AutoSyncRunResult = {
    checked: accounts.length,
    synced: 0,
    skipped: 0,
    errors: [],
  };

  for (const account of accounts) {
    const key = accountKey(account);

    if (!shouldRunAutoSync(account, now)) {
      result.skipped += 1;
      continue;
    }

    if (!syncLock.acquire(key)) {
      result.skipped += 1;
      await updateAccountSyncStatus({
        posProvider: account.posProvider as POSProvider,
        posAccountId: account.posAccountId,
        lastSyncStatus: "skipped",
        nextSyncAt: nextSyncAt(now, account.syncIntervalMinutes),
        lastSyncError: "Previous sync is still running.",
      });
      continue;
    }

    await updateAccountSyncStatus({
      posProvider: account.posProvider as POSProvider,
      posAccountId: account.posAccountId,
      lastSyncStatus: "running",
      lastSyncError: null,
    });

    try {
      await syncAccount(account);
      const completedAt = new Date();
      await updateAccountSyncStatus({
        posProvider: account.posProvider as POSProvider,
        posAccountId: account.posAccountId,
        lastSyncStatus: "success",
        lastSyncAt: completedAt,
        nextSyncAt: nextSyncAt(completedAt, account.syncIntervalMinutes),
        lastSyncError: null,
      });
      result.synced += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Auto sync failed.";
      const completedAt = new Date();
      await updateAccountSyncStatus({
        posProvider: account.posProvider as POSProvider,
        posAccountId: account.posAccountId,
        lastSyncStatus: "error",
        lastSyncAt: completedAt,
        nextSyncAt: nextSyncAt(completedAt, account.syncIntervalMinutes),
        lastSyncError: message,
      });
      await appendSyncFailureLog(
        { merchantId: account.merchantId, posProvider: account.posProvider as POSProvider },
        "auto-sync",
        message
      );
      result.errors.push({ account: key, error: message });
    } finally {
      syncLock.release(key);
    }
  }

  return result;
}
