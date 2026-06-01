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

It does not poll transactions.

Local/dev route:

```bash
curl -X POST "http://localhost:3000/api/dev/poster/sync?pos_account_id=YOUR_POSTER_ACCOUNT"
```

Production requires `DEV_SYNC_SECRET`:

```bash
curl -X POST \
  -H "x-dev-sync-secret: $DEV_SYNC_SECRET" \
  "https://your-app.example/api/dev/poster/sync?pos_account_id=YOUR_POSTER_ACCOUNT"
```

CLI:

```bash
pnpm poster:sync -- --pos-account-id=YOUR_POSTER_ACCOUNT
```
