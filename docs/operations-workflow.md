# Operational Workflow

PR #5 adds the first real-world operations surface without changing the Keg Board visual system.

## Flow

1. Connect a POS account from the POS tab.
2. Run manual sync to fetch catalog data and transactions.
3. Create or use an active barrel.
4. Map one or more POS products to that barrel.
5. Configure `cup_ml` per POS product.
6. Run manual sync again to recalculate active barrel consumption, revenue, yield, and logs.

## POS-Agnostic Boundaries

- The UI calls `/api/ops/*` routes.
- `/api/ops/sync` routes by `pos_provider`.
- Poster is currently the only live connector.
- Demo mode uses the `mock` provider and does not require Poster credentials.

## Idempotency

Transaction ingestion remains idempotent through `normalized_sales` upserts on
`merchant_id`, `pos_provider`, and `external_transaction_id`. Active barrel totals
are recalculated from stored normalized sales, so repeated manual syncs do not
double-count transactions.

## Persistence

Product-to-barrel mappings persist to `barrels.external_product_ids`.
Cup size mappings persist to `products.cup_ml`.
Sync status persists to `polling_logs.last_synced_at` and `polling_logs.raw`.
