import { eq, and, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import type { POSProvider } from "@/lib/pos/types";

export interface SaveAccountInput {
  userId: string;
  merchantId: string;
  posProvider: POSProvider;
  posAccountId: string;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  raw?: unknown;
}

export interface POSAccountRecord {
  id: string;
  userId: string | null;
  merchantId: string;
  posProvider: string;
  posAccountId: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: Date | null;
  nextSyncAt: Date | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export interface AccountSyncStatusInput {
  posProvider: POSProvider;
  posAccountId: string;
  lastSyncStatus: "running" | "success" | "error" | "skipped";
  lastSyncAt?: Date | null;
  nextSyncAt?: Date | null;
  lastSyncError?: string | null;
}

export interface AccountAutoSyncSettingsInput {
  posProvider: POSProvider;
  posAccountId: string;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
}

export async function saveAccount(input: SaveAccountInput): Promise<POSAccountRecord> {
  const runtime = getDatabase();
  const now = new Date();
  const id = `${input.posProvider}:${input.posAccountId}`;

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .insert(pg.accounts)
      .values({
        id,
        userId: input.userId,
        merchantId: input.merchantId,
        posProvider: input.posProvider,
        posAccountId: input.posAccountId,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken ?? null,
        tokenExpiresAt: input.tokenExpiresAt ?? null,
        nextSyncAt: new Date(now.getTime() + 5 * 60 * 1000),
        raw: input.raw ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pg.accounts.posProvider, pg.accounts.posAccountId],
        set: {
          userId: sql`excluded.user_id`,
          merchantId: sql`excluded.merchant_id`,
          accessToken: sql`excluded.access_token`,
          refreshToken: sql`excluded.refresh_token`,
          tokenExpiresAt: sql`excluded.token_expires_at`,
          nextSyncAt: sql`coalesce(${pg.accounts.nextSyncAt}, excluded.next_sync_at)`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      })
      .returning();
    return toAccountRecord(rows[0]);
  }

  const rows = await runtime.db
    .insert(sqlite.accounts)
    .values({
      id,
      userId: input.userId,
      merchantId: input.merchantId,
      posProvider: input.posProvider,
      posAccountId: input.posAccountId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken ?? null,
      tokenExpiresAt: input.tokenExpiresAt ?? null,
      nextSyncAt: new Date(now.getTime() + 5 * 60 * 1000),
      raw: input.raw ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sqlite.accounts.posProvider, sqlite.accounts.posAccountId],
      set: {
        userId: sql`excluded.user_id`,
        merchantId: sql`excluded.merchant_id`,
        accessToken: sql`excluded.access_token`,
        refreshToken: sql`excluded.refresh_token`,
        tokenExpiresAt: sql`excluded.token_expires_at`,
        nextSyncAt: sql`coalesce(${sqlite.accounts.nextSyncAt}, excluded.next_sync_at)`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })
    .returning();
  return toAccountRecord(rows[0]);
}

export async function getAccountByProvider(
  posProvider: POSProvider,
  posAccountId: string
): Promise<POSAccountRecord | null> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .select()
      .from(pg.accounts)
      .where(and(eq(pg.accounts.posProvider, posProvider), eq(pg.accounts.posAccountId, posAccountId)))
      .limit(1);
    return rows[0] ? toAccountRecord(rows[0]) : null;
  }

  const rows = await runtime.db
    .select()
    .from(sqlite.accounts)
    .where(and(eq(sqlite.accounts.posProvider, posProvider), eq(sqlite.accounts.posAccountId, posAccountId)))
    .limit(1);
  return rows[0] ? toAccountRecord(rows[0]) : null;
}

export async function getFirstAccountByProvider(posProvider: POSProvider): Promise<POSAccountRecord | null> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .select()
      .from(pg.accounts)
      .where(eq(pg.accounts.posProvider, posProvider))
      .limit(1);
    return rows[0] ? toAccountRecord(rows[0]) : null;
  }

  const rows = await runtime.db
    .select()
    .from(sqlite.accounts)
    .where(eq(sqlite.accounts.posProvider, posProvider))
    .limit(1);
  return rows[0] ? toAccountRecord(rows[0]) : null;
}

export async function getConnectedAccountsForAutoSync(): Promise<POSAccountRecord[]> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db.select().from(pg.accounts);
    return rows.map(toAccountRecord).filter((account) => Boolean(account.accessToken));
  }

  const rows = await runtime.db.select().from(sqlite.accounts);
  return rows.map(toAccountRecord).filter((account) => Boolean(account.accessToken));
}

export async function updateAccountSyncStatus(input: AccountSyncStatusInput): Promise<void> {
  const runtime = getDatabase();
  const now = new Date();
  const values = {
    lastSyncStatus: input.lastSyncStatus,
    ...(input.lastSyncAt !== undefined ? { lastSyncAt: input.lastSyncAt } : {}),
    ...(input.nextSyncAt !== undefined ? { nextSyncAt: input.nextSyncAt } : {}),
    ...(input.lastSyncError !== undefined ? { lastSyncError: input.lastSyncError } : {}),
    updatedAt: now,
  };

  if (runtime.dialect === "postgres") {
    await runtime.db
      .update(pg.accounts)
      .set(values)
      .where(and(eq(pg.accounts.posProvider, input.posProvider), eq(pg.accounts.posAccountId, input.posAccountId)));
    return;
  }

  await runtime.db
    .update(sqlite.accounts)
    .set(values)
    .where(and(eq(sqlite.accounts.posProvider, input.posProvider), eq(sqlite.accounts.posAccountId, input.posAccountId)));
}

export async function updateAccountAutoSyncSettings(input: AccountAutoSyncSettingsInput): Promise<void> {
  const runtime = getDatabase();
  const now = new Date();
  const intervalMinutes =
    Number.isFinite(input.syncIntervalMinutes) && input.syncIntervalMinutes > 0
      ? Math.round(input.syncIntervalMinutes)
      : 5;
  const values = {
    autoSyncEnabled: input.autoSyncEnabled,
    syncIntervalMinutes: intervalMinutes,
    nextSyncAt: input.autoSyncEnabled ? new Date(now.getTime() + intervalMinutes * 60 * 1000) : null,
    lastSyncStatus: input.autoSyncEnabled ? "scheduled" : "disabled",
    lastSyncError: null,
    updatedAt: now,
  };

  if (runtime.dialect === "postgres") {
    await runtime.db
      .update(pg.accounts)
      .set(values)
      .where(and(eq(pg.accounts.posProvider, input.posProvider), eq(pg.accounts.posAccountId, input.posAccountId)));
    return;
  }

  await runtime.db
    .update(sqlite.accounts)
    .set(values)
    .where(and(eq(sqlite.accounts.posProvider, input.posProvider), eq(sqlite.accounts.posAccountId, input.posAccountId)));
}

function toAccountRecord(row: typeof pg.accounts.$inferSelect | typeof sqlite.accounts.$inferSelect): POSAccountRecord {
  return {
    id: row.id,
    userId: row.userId,
    merchantId: row.merchantId,
    posProvider: row.posProvider,
    posAccountId: row.posAccountId,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    tokenExpiresAt: row.tokenExpiresAt,
    autoSyncEnabled: row.autoSyncEnabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lastSyncAt: row.lastSyncAt,
    nextSyncAt: row.nextSyncAt,
    lastSyncStatus: row.lastSyncStatus,
    lastSyncError: row.lastSyncError,
  };
}
