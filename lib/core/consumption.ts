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
}

export interface ConsumptionSaleInput {
  id: string;
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

const emptyTotals = (): ConsumptionTotals => ({
  ml_consumed: 0,
  revenue_bruto_cents: 0,
  revenue_descuentos_cents: 0,
  revenue_neto_cents: 0,
});

export function calculateBarrelConsumption(
  barrels: ConsumptionBarrelInput[],
  sales: ConsumptionSaleInput[],
  cupMlByExternalProductId: Record<string, number>
): BarrelConsumptionTotals {
  const totals = Object.fromEntries(barrels.map((barrel) => [barrel.id, emptyTotals()]));
  const productToBarrelId = new Map<string, string>();

  for (const barrel of barrels) {
    for (const externalProductId of barrel.externalProductIds ?? []) {
      if (!productToBarrelId.has(externalProductId)) {
        productToBarrelId.set(externalProductId, barrel.id);
      }
    }
  }

  for (const sale of sales) {
    if (sale.is_refunded || sale.is_voided) continue;

    for (const item of sale.line_items) {
      const barrelId = productToBarrelId.get(item.external_product_id);
      if (!barrelId) continue;

      const cupMl = cupMlByExternalProductId[item.external_product_id] ?? 0;
      if (cupMl <= 0 || item.quantity <= 0) continue;

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
