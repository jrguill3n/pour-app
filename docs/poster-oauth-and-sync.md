# Poster OAuth And Manual Sync

This PR adds the server-side skeleton for connecting Poster and manually syncing catalog data.

## Environment

```bash
POSTER_APPLICATION_ID=
POSTER_APPLICATION_SECRET=
POSTER_REDIRECT_URI=http://localhost:3000/api/auth/poster/callback

# Local SQLite is used by default.
SQLITE_DATABASE_URL=file:./data/dev.db

# Production Postgres.
DATABASE_DIALECT=postgres
DATABASE_URL=

# Required only when calling the dev sync route in production.
DEV_SYNC_SECRET=
```

## OAuth

- Start: `GET /api/auth/poster/start`
- Callback: `GET /api/auth/poster/callback`

The callback exchanges the Poster code using the existing Poster connector, creates or updates the local user, and persists the Poster account in `accounts` with:

- `pos_provider = poster`
- `pos_account_id = Poster account number`
- `merchant_id = Poster account number`
- `access_token`
- `refresh_token` when provided
- raw OAuth payload

## Manual Sync

Manual sync intentionally covers only catalog data:

- products
- locations/spots
- employees
- transactions

It does not run live polling. Transaction sync is manual and idempotent: normalized sales are upserted by `(merchant_id, pos_provider, external_transaction_id)`, then active keg consumption is recalculated from normalized sales instead of incremented.

Consumption metrics are matched by `barrels.external_product_ids` against sale line item `external_product_id` values. Product `cup_ml` is the configurable pour size used to calculate `ml_consumed`; the repository exposes `saveProductCupMlMappings()` for future admin tooling. Refunded or voided sales are persisted but ignored for barrel consumption and revenue metrics.

Local/dev route:

```bash
curl -X POST "http://localhost:3000/api/dev/poster/sync?pos_account_id=YOUR_POSTER_ACCOUNT&from=2026-06-01&to=2026-06-02"
```

Production requires `DEV_SYNC_SECRET`:

```bash
curl -X POST \
  -H "x-dev-sync-secret: $DEV_SYNC_SECRET" \
  "https://your-app.example/api/dev/poster/sync?pos_account_id=YOUR_POSTER_ACCOUNT&from=2026-06-01&to=2026-06-02"
```

CLI:

```bash
pnpm poster:sync -- --pos-account-id=YOUR_POSTER_ACCOUNT --from=2026-06-01 --to=2026-06-02
```
