import { dirname } from "node:path";
import Database from "better-sqlite3";

const sqliteUrl = process.env.SQLITE_DATABASE_URL ?? "file:./data/dev.db";
const sqlitePath = sqliteUrl.startsWith("file:") ? sqliteUrl.slice("file:".length) : sqliteUrl;
const merchantId = process.argv.find((arg) => arg.startsWith("--merchant-id="))?.split("=")[1] ?? "624548";

const db = new Database(sqlitePath, { readonly: true, fileMustExist: true });

const barrel = db
  .prepare(
    `select id, merchant_id, pos_provider, opened_by, opened_at, price_paid_cents, volume_ml,
      external_product_ids, ml_consumed, revenue_bruto_cents, revenue_descuentos_cents, revenue_neto_cents
    from barrels
    where merchant_id = ? and status = 'active'
    order by opened_at desc
    limit 1`
  )
  .get(merchantId) as Record<string, unknown> | undefined;

if (!barrel) {
  console.log(JSON.stringify({ database: sqlitePath, merchantId, activeBarrel: null }, null, 2));
  process.exit(0);
}

const externalProductIds = JSON.parse(String(barrel.external_product_ids ?? "[]")) as string[];
const openedAt = Number(barrel.opened_at ?? 0);
const sales = db
  .prepare(
    `select id, external_transaction_id, created_at, line_items, raw
    from normalized_sales
    where merchant_id = ? and created_at >= ?
    order by created_at`
  )
  .all(merchantId, openedAt) as Record<string, unknown>[];
const productRows = db
  .prepare(
    `select external_product_id, name, variant_name
    from products
    where merchant_id = ?`
  )
  .all(merchantId) as Array<{ external_product_id: string; name: string; variant_name: string | null }>;
const products = new Map(productRows.map((product) => [String(product.external_product_id), product]));

const matchedSales = sales.flatMap((sale) => {
  const lineItems = JSON.parse(String(sale.line_items ?? "[]")) as Array<Record<string, unknown>>;
  const raw = JSON.parse(String(sale.raw ?? "{}")) as { products?: Array<Record<string, unknown>>; date_close?: string };

  return lineItems.flatMap((item, index) => {
    const externalProductId = String(item.external_product_id ?? "");
    if (!externalProductIds.includes(externalProductId)) return [];

    const rawProduct = raw.products?.find((product) => {
      const modificationId = product.modification_id;
      const rawExternalProductId =
        modificationId && String(modificationId) !== "0"
          ? `${product.product_id}:${modificationId}`
          : String(product.product_id);
      return rawExternalProductId === externalProductId;
    });
    const product = products.get(externalProductId);

    return [{
      sale_id: sale.id,
      external_transaction_id: sale.external_transaction_id,
      external_line_item_id: `${sale.external_transaction_id}:${index}`,
      external_product_id: externalProductId,
      product_name: product?.name ?? item.name ?? null,
      variant_name: product?.variant_name ?? null,
      quantity: item.quantity,
      gross_cents: item.gross_cents,
      discount_cents: item.discount_cents,
      net_cents: item.net_cents,
      sold_at: new Date(Number(sale.created_at) * 1000).toISOString(),
      raw_poster_fields: {
        product_sum: rawProduct?.product_sum ?? null,
        discount: rawProduct?.discount ?? null,
        payed_sum: rawProduct?.payed_sum ?? null,
        num: rawProduct?.num ?? null,
        product_id: rawProduct?.product_id ?? null,
        modification_id: rawProduct?.modification_id ?? null,
        date_close: raw.date_close ?? null,
      },
    }];
  });
});

console.log(
  JSON.stringify(
    {
      database: sqlitePath,
      database_dir: dirname(sqlitePath),
      activeBarrel: {
        ...barrel,
        opened_at_iso: new Date(openedAt * 1000).toISOString(),
        external_product_ids: externalProductIds,
      },
      matchedSales,
    },
    null,
    2
  )
);
