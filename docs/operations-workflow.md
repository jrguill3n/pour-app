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
- Connected mode never falls back to seeded `mock` products, barrels, templates,
  or mappings. Real merchants only see records stored under their own
  `merchant_id` and `pos_provider`.

## Demo Data Boundary

Seeded demo data belongs only to `merchant_id = mock-merchant` and
`pos_provider = mock`. When any real POS account is connected, Pour prefers that
real account for operational snapshots and hides demo barrels/templates unless
the user explicitly requests demo mode.

For a local reset that leaves real synced Poster data untouched, run:

```bash
pnpm run db:reset-demo
```

## Poster Read-Only Boundary

Pour treats Poster as a read-only source of truth. Poster sync may read products,
locations/spots, employees, and transactions, then save normalized copies in
Pour's database. Barrel opening/closing, product-to-barrel mappings, cup sizes,
consumption metrics, revenue metrics, and sync logs are local Pour records only.

Do not add Poster create, update, delete, or other mutation calls unless they are
isolated behind an explicitly disabled integration path.

## Idempotency

Transaction ingestion remains idempotent through `normalized_sales` upserts on
`merchant_id`, `pos_provider`, and `external_transaction_id`. Active barrel totals
are recalculated from stored normalized sales, so repeated manual syncs do not
double-count transactions.

## Persistence

Product-to-barrel mappings persist to `barrels.external_product_ids`.
Cup size mappings persist to `products.cup_ml`.
Draft category eligibility persists to `pos_product_categories.is_draft_eligible`.
Sync status persists to `polling_logs.last_synced_at` and `polling_logs.raw`.

## Draft Category Filtering

Pour syncs and stores every POS product for data completeness. Merchant-level
draft category settings only filter product candidates in barrel mapping and
Create Keg. If no eligible categories are selected, Pour shows all products and
warns the user to configure draft categories.
