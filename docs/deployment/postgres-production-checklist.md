# Production Postgres Deployment Checklist

Use this checklist before pointing a real bar at Pour production.

## Required Environment

- `DATABASE_DIALECT=postgres`
- `DATABASE_URL` points to the production Postgres database.
- `POSTER_APPLICATION_ID` is set.
- `POSTER_APPLICATION_SECRET` is set.
- `POSTER_REDIRECT_URI` exactly matches the Poster app callback URL.
- `APP_URL` is the production app URL.
- `SYNC_CRON_SECRET` is set for cron callers.
- `POUR_ADMIN_SECRET` or `PILOT_ADMIN_SECRET` is set for protected dev/admin endpoints.

Do not set `SQLITE_DATABASE_URL` as the only database URL in production. If `DATABASE_DIALECT` and `DATABASE_URL` are both missing, Pour falls back to SQLite.

## Database

- Run `pnpm run db:push` against the production database.
- Confirm the `accounts` table has `pos_provider`, `pos_account_id`, sync settings, and token columns.
- Confirm `products`, `locations`, `employees`, `barrels`, `normalized_sales`, and `polling_logs` exist.
- Confirm `accounts(pos_provider, pos_account_id)` is unique.
- Confirm `barrels.external_product_ids`, `barrels.location_id`, and `products.external_product_id` exist.

## Protected Routes

- `/api/ops/cron/sync` requires `SYNC_CRON_SECRET` or an admin secret in production.
- `/api/dev/poster/sync` requires an admin/dev secret in production.
- `/api/debug/environment` requires an admin secret in production and must be disabled unless needed.
- `/api/ops/sync` accepts same-origin UI requests and protected server/API requests.

Never place server-only secrets in client-side code.

## Verification

- Deploy the intended branch and commit.
- Check `/api/debug/environment` with an admin secret:
  - commit sha is expected
  - `databaseDialect` is `postgres`
  - `databaseReachable` is true
  - `connectedMerchantCount` is at least 1 after OAuth
  - `demoMode` is false for real merchants
- Connect Poster OAuth.
- Run Sync Now from the Ops tab.
- Confirm `/api/ops/status` returns connected mode, products, transaction logs, and active barrels.
- Confirm the Keg Board does not show seeded demo barrels for real merchant accounts.

