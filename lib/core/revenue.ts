import type { Barrel, BarConfig } from "@/lib/core/types";
import { getExcessMermaMl } from "@/lib/core/consumption";
import type { NormalizedSale } from "@/lib/pos/types";

export interface RevenueTotals {
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
}

export function getRevenueTotals(sales: NormalizedSale[]): RevenueTotals {
  return sales.reduce(
    (totals, sale) => ({
      gross_cents: totals.gross_cents + sale.gross_cents,
      discount_cents: totals.discount_cents + sale.discount_cents,
      net_cents: totals.net_cents + sale.net_cents,
    }),
    { gross_cents: 0, discount_cents: 0, net_cents: 0 }
  );
}

export function getMermaLostValue(barrel: Barrel, config: BarConfig): number {
  return getExcessMermaMl(barrel.mermaMl, barrel.volumeL, config.maxMermaPct) * config.pricePerMl;
}

export function getRevenuePerLiter(netCents: number, consumedMl: number): string {
  if (consumedMl <= 0) return "0";
  return (netCents / 100 / (consumedMl / 1000)).toFixed(2);
}
