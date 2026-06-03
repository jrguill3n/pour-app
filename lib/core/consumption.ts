export function getTotalMl(volumeL: number): number {
  return volumeL * 1000;
}

export function getRemainingPct(consumedMl: number, totalMl: number): number {
  if (!Number.isFinite(consumedMl) || !Number.isFinite(totalMl)) return 0;
  if (totalMl <= 0) return 0;
  return Math.max(0, Math.min(100, 100 - (consumedMl / totalMl) * 100));
}

export function getConsumedPct(consumedMl: number, totalMl: number): number {
  if (!Number.isFinite(consumedMl) || !Number.isFinite(totalMl)) return 0;
  if (totalMl <= 0) return 0;
  return Math.max(0, Math.min(100, (consumedMl / totalMl) * 100));
}

export function getYieldPct(consumedMl: number, totalMl: number): string {
  return getConsumedPct(consumedMl, totalMl).toFixed(1);
}

export function getExcessMermaMl(mermaMl: number, volumeL: number, maxMermaPct: number): number {
  const allowedMermaMl = (maxMermaPct / 100) * getTotalMl(volumeL);
  return Math.max(0, mermaMl - allowedMermaMl);
}

export function formatLiters(ml: number): string {
  if (!Number.isFinite(ml) || ml <= 0) return "0ml";
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`;
}

export interface ConsumptionBarrelInput {
  id: string;
  externalProductIds: string[] | null;
  opened_at?: string | Date | null;
}

export interface ConsumptionSaleInput {
  id: string;
  created_at?: string | Date | null;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  is_refunded?: boolean;
  is_voided?: boolean;
  line_items: {
    external_product_id: string;
    quantity: number;
    gross_cents: number;
    discount_cents?: number;
    net_cents?: number;
  }[];
}

export interface ConsumptionTotals {
  ml_consumed: number;
  revenue_bruto_cents: number;
  revenue_descuentos_cents: number;
  revenue_neto_cents: number;
}

export type BarrelConsumptionTotals = Record<string, ConsumptionTotals>;

export interface BarrelConsumptionDiagnostic {
  barrel_id: string;
  opened_at: string | null;
  matched_transaction_count: number;
  earliest_matched_sold_at: string | null;
  latest_matched_sold_at: string | null;
  matched_external_product_ids: string[];
}

const emptyTotals = (): ConsumptionTotals => ({
  ml_consumed: 0,
  revenue_bruto_cents: 0,
  revenue_descuentos_cents: 0,
  revenue_neto_cents: 0,
});

function timestampMs(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function calculateBarrelConsumption(
  barrels: ConsumptionBarrelInput[],
  sales: ConsumptionSaleInput[],
  cupMlByExternalProductId: Record<string, number>
): BarrelConsumptionTotals {
  const totals = Object.fromEntries(barrels.map((barrel) => [barrel.id, emptyTotals()]));
  const productToBarrels = new Map<string, ConsumptionBarrelInput[]>();

  for (const barrel of barrels) {
    for (const externalProductId of barrel.externalProductIds ?? []) {
      productToBarrels.set(externalProductId, [...(productToBarrels.get(externalProductId) ?? []), barrel]);
    }
  }

  for (const sale of sales) {
    if (sale.is_refunded || sale.is_voided) continue;
    const saleMs = timestampMs(sale.created_at);

    for (const item of sale.line_items) {
      const matchedBarrel = (productToBarrels.get(item.external_product_id) ?? []).find((barrel) => {
        const openedMs = timestampMs(barrel.opened_at);
        return !openedMs || !saleMs || saleMs >= openedMs;
      });
      if (!matchedBarrel) continue;

      const cupMl = cupMlByExternalProductId[item.external_product_id] ?? 0;
      if (cupMl <= 0 || item.quantity <= 0) continue;

      const barrelId = matchedBarrel.id;
      const barrelTotals = totals[barrelId] ?? emptyTotals();
      const discountCents =
        item.discount_cents ??
        (sale.gross_cents > 0 ? Math.round((sale.discount_cents * item.gross_cents) / sale.gross_cents) : 0);
      const netCents = item.net_cents ?? item.gross_cents - discountCents;

      barrelTotals.ml_consumed += Math.round(item.quantity * cupMl);
      barrelTotals.revenue_bruto_cents += item.gross_cents;
      barrelTotals.revenue_descuentos_cents += discountCents;
      barrelTotals.revenue_neto_cents += netCents;
      totals[barrelId] = barrelTotals;
    }
  }

  return totals;
}

export function calculateBarrelConsumptionDiagnostics(
  barrels: ConsumptionBarrelInput[],
  sales: ConsumptionSaleInput[]
): BarrelConsumptionDiagnostic[] {
  return barrels.map((barrel) => {
    const openedMs = timestampMs(barrel.opened_at);
    const matchedSales: { createdAt: string | null; productIds: string[] }[] = [];

    for (const sale of sales) {
      if (sale.is_refunded || sale.is_voided) continue;
      const saleMs = timestampMs(sale.created_at);
      if (openedMs && saleMs && saleMs < openedMs) continue;

      const matchedProductIds = sale.line_items
        .map((item) => item.external_product_id)
        .filter((externalProductId) => (barrel.externalProductIds ?? []).includes(externalProductId));

      if (matchedProductIds.length > 0) {
        matchedSales.push({
          createdAt: sale.created_at ? new Date(sale.created_at).toISOString() : null,
          productIds: matchedProductIds,
        });
      }
    }

    const matchedDates = matchedSales
      .map((sale) => sale.createdAt)
      .filter((createdAt): createdAt is string => Boolean(createdAt))
      .sort();

    return {
      barrel_id: barrel.id,
      opened_at: barrel.opened_at ? new Date(barrel.opened_at).toISOString() : null,
      matched_transaction_count: matchedSales.length,
      earliest_matched_sold_at: matchedDates[0] ?? null,
      latest_matched_sold_at: matchedDates.at(-1) ?? null,
      matched_external_product_ids: [...new Set(matchedSales.flatMap((sale) => sale.productIds))],
    };
  });
}
