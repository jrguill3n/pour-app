import { defineConfig } from "drizzle-kit";

const dialect = process.env.DATABASE_DIALECT === "postgres" || process.env.DATABASE_URL
  ? "postgresql"
  : "sqlite";

export default defineConfig({
  dialect,
  schema: dialect === "postgresql" ? "./lib/db/schema/postgres.ts" : "./lib/db/schema/sqlite.ts",
  out: dialect === "postgresql" ? "./drizzle/postgres" : "./drizzle/sqlite",
  dbCredentials:
    dialect === "postgresql"
      ? {
          url: process.env.DATABASE_URL ?? "",
        }
      : {
          url: process.env.SQLITE_DATABASE_URL ?? "file:./data/dev.db",
        },
  strict: false,
  verbose: true,
});
