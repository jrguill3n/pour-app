# Automatic POS Sync Scheduler

Pour treats connected POS systems as read-only sources of truth. Automatic sync uses
the same server-side sync path as manual sync:

- products
- locations
- employees
- transactions
- active barrel recalculation

The scheduler never writes to Poster. It only reads POS data and writes normalized
copies, sync status, and barrel metrics into Pour's database.

## Local Development

Run the app normally:

```bash
pnpm dev
```

Then trigger due auto-sync jobs:

```bash
curl http://localhost:3000/api/ops/cron/sync
```

Local/dev requests do not require a cron secret. Connected accounts default to:

- `auto_sync_enabled=true`
- `sync_interval_minutes=5`

The POS/Ops tab shows Auto-sync ON/OFF, interval, last sync, next sync, and the
last result/error. Manual `Sync Now` continues to use `/api/ops/sync`.
Manual sync, auto-sync, and the legacy development sync route all dispatch
through the same shared manual sync engine.

## Production

Use Vercel Cron or an external cron service to call:

```text
GET /api/ops/cron/sync
```

In production, protect the endpoint with:

```bash
SYNC_CRON_SECRET=replace-me
POUR_ADMIN_SECRET=replace-me
```

Send the secret either as a query param or header:

```bash
curl "https://your-app.example/api/ops/cron/sync?secret=$SYNC_CRON_SECRET"
curl -H "x-sync-cron-secret: $SYNC_CRON_SECRET" https://your-app.example/api/ops/cron/sync
```

Suggested Vercel schedule:

```json
{
  "crons": [
    {
      "path": "/api/ops/cron/sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

If using Vercel Cron without custom headers, configure the path with a secret
query param or route it through a small external cron service that can set
`x-sync-cron-secret`.

## Required Env Vars

```bash
APP_URL=https://your-app.example
DATABASE_DIALECT=postgres
DATABASE_URL=postgres://...
POSTER_APPLICATION_ID=...
POSTER_APPLICATION_SECRET=...
POSTER_REDIRECT_URI=https://your-app.example/api/auth/poster/callback
SYNC_CRON_SECRET=replace-me
```

For local SQLite:

```bash
DATABASE_DIALECT=sqlite
SQLITE_DATABASE_URL=file:./data/dev.db
```

## Safety

- The scheduler uses an in-process lock to prevent overlapping jobs in local/dev.
- Normalized sales are idempotent through the existing unique transaction key.
- Provider-specific sync is dispatched through the shared sync engine.
- Development and admin routes require `POUR_ADMIN_SECRET`, `PILOT_ADMIN_SECRET`,
  or the route-specific secret in production.
- Poster remains read-only.
