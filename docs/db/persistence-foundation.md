# Persistence Foundation

This app uses Drizzle for the POS persistence layer.

- Local development defaults to SQLite at `file:./data/dev.db`.
- Production can use Postgres by setting `DATABASE_DIALECT=postgres` and `DATABASE_URL`.
- SQLite schema lives in `lib/db/schema/sqlite.ts`.
- Postgres-compatible schema lives in `lib/db/schema/postgres.ts`.
- Normalized POS writes live in `lib/db/repositories/pos.ts`.

Useful commands:

```bash
pnpm db:push
pnpm db:seed
pnpm db:setup
```

Live polling is intentionally not implemented yet. The repository layer is ready for a future Poster sync job to call `saveProducts()`, `saveLocations()`, `saveEmployees()`, and `saveSales()`.
