import { eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";

export interface SaveUserInput {
  email: string;
  name?: string | null;
  raw?: unknown;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
}

export async function saveUser(input: SaveUserInput): Promise<UserRecord> {
  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    const existing = await runtime.db
      .select()
      .from(pg.users)
      .where(eq(pg.users.email, input.email))
      .limit(1);

    if (existing[0]) {
      const rows = await runtime.db
        .update(pg.users)
        .set({ name: input.name ?? existing[0].name, raw: input.raw ?? existing[0].raw, updatedAt: now })
        .where(eq(pg.users.email, input.email))
        .returning();
      return toUserRecord(rows[0]);
    }

    const rows = await runtime.db
      .insert(pg.users)
      .values({
        id: crypto.randomUUID(),
        email: input.email,
        name: input.name ?? null,
        raw: input.raw ?? null,
      })
      .onConflictDoUpdate({
        target: pg.users.email,
        set: {
          name: sql`excluded.name`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      })
      .returning();
    return toUserRecord(rows[0]);
  }

  const existing = await runtime.db
    .select()
    .from(sqlite.users)
    .where(eq(sqlite.users.email, input.email))
    .limit(1);

  if (existing[0]) {
    const rows = await runtime.db
      .update(sqlite.users)
      .set({ name: input.name ?? existing[0].name, raw: input.raw ?? existing[0].raw, updatedAt: now })
      .where(eq(sqlite.users.email, input.email))
      .returning();
    return toUserRecord(rows[0]);
  }

  const rows = await runtime.db
    .insert(sqlite.users)
    .values({
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name ?? null,
      raw: input.raw ?? null,
    })
    .onConflictDoUpdate({
      target: sqlite.users.email,
      set: {
        name: sql`excluded.name`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    })
    .returning();
  return toUserRecord(rows[0]);
}

function toUserRecord(row: typeof pg.users.$inferSelect | typeof sqlite.users.$inferSelect): UserRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
  };
}
