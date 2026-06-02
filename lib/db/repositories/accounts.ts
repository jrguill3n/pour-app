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
  };
}
