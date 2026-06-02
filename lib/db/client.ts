import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import * as sqliteSchema from "@/lib/db/schema/sqlite";
import * as pgSchema from "@/lib/db/schema/postgres";

export type DatabaseDialect = "sqlite" | "postgres";

let sqliteDb: ReturnType<typeof drizzleSqlite<typeof sqliteSchema>> | null = null;
let pgDb: ReturnType<typeof drizzleNeon<typeof pgSchema>> | null = null;

export function getDatabaseDialect(): DatabaseDialect {
  return process.env.DATABASE_DIALECT === "postgres" || process.env.DATABASE_URL
    ? "postgres"
    : "sqlite";
}

export function getSqliteDatabase() {
  if (!sqliteDb) {
    const url = process.env.SQLITE_DATABASE_URL ?? "file:./data/dev.db";
    const filePath = url.startsWith("file:") ? url.slice("file:".length) : url;
    sqliteDb = drizzleSqlite(new Database(filePath), { schema: sqliteSchema });
  }

  return sqliteDb;
}

export function getPostgresDatabase() {
  if (!pgDb) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error("DATABASE_URL is required when DATABASE_DIALECT=postgres.");
    }

    pgDb = drizzleNeon(neon(databaseUrl), { schema: pgSchema });
  }

  return pgDb;
}

export function getDatabase() {
  const dialect = getDatabaseDialect();

  return dialect === "postgres"
    ? { dialect, db: getPostgresDatabase() }
    : { dialect, db: getSqliteDatabase() };
}
