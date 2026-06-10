export interface BarrelCloseValidationInput {
  status: string;
  volumeMl: number;
  mlConsumed: number;
  mermaMl: number;
  grossRevenueCents: number;
  discountRevenueCents: number;
  netRevenueCents: number;
  openedAt: Date | string;
  closedAt: Date | string;
  closedBy?: string | null;
}

export interface BarrelCloseSummary {
  mermaMl: number;
  finalYieldPct: number;
  finalYieldPctBasisPoints: number;
  grossRevenueCents: number;
  discountRevenueCents: number;
  netRevenueCents: number;
}

function validMoney(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function validDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function validateBarrelClose(input: BarrelCloseValidationInput): {
  ok: boolean;
  errors: string[];
  summary?: BarrelCloseSummary;
} {
  const errors: string[] = [];
  const volumeMl = Math.round(input.volumeMl);
  const mlConsumed = Math.round(input.mlConsumed);
  const mermaMl = Math.round(input.mermaMl);
  const openedAt = validDate(input.openedAt);
  const closedAt = validDate(input.closedAt);

  if (input.status !== "active") errors.push("Only active barrels can be closed.");
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) errors.push("volume_ml must be greater than 0.");
  if (!Number.isFinite(mlConsumed) || mlConsumed < 0) errors.push("ml_consumed must be 0 or greater.");
  if (!Number.isFinite(mermaMl) || mermaMl < 0) errors.push("merma_ml must be 0 or greater.");
  if (volumeMl > 0 && mermaMl > volumeMl) errors.push("merma_ml cannot exceed barrel volume.");
  if (volumeMl > 0 && mlConsumed + mermaMl > volumeMl) errors.push("ml_consumed plus merma_ml cannot exceed barrel volume.");
  if (!input.closedBy?.trim()) errors.push("closed_by is required.");
  if (!openedAt) errors.push("opened_at must be a valid date.");
  if (!closedAt) errors.push("closed_at must be a valid date.");
  if (openedAt && closedAt && closedAt < openedAt) errors.push("closed_at cannot be before opened_at.");
  if (!validMoney(input.grossRevenueCents)) errors.push("gross revenue must be 0 or greater.");
  if (!validMoney(input.discountRevenueCents)) errors.push("discount revenue must be 0 or greater.");
  if (!validMoney(input.netRevenueCents)) errors.push("net revenue must be 0 or greater.");
  if (input.discountRevenueCents > input.grossRevenueCents) errors.push("discount revenue cannot exceed gross revenue.");
  if (input.netRevenueCents > input.grossRevenueCents) errors.push("net revenue cannot exceed gross revenue.");
  if (input.grossRevenueCents - input.discountRevenueCents !== input.netRevenueCents) {
    errors.push("gross revenue minus discounts must equal net revenue.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const finalYieldPct = ((mlConsumed + mermaMl) / volumeMl) * 100;

  return {
    ok: true,
    errors: [],
    summary: {
      mermaMl,
      finalYieldPct,
      finalYieldPctBasisPoints: Math.round(finalYieldPct * 100),
      grossRevenueCents: input.grossRevenueCents,
      discountRevenueCents: input.discountRevenueCents,
      netRevenueCents: input.netRevenueCents,
    },
  };
}

export function closedBarrelHistoryWarnings(input: {
  status: string;
  volumeMl: number;
  mlConsumed: number;
  mermaMl: number;
  closedAt?: string | null;
  closedBy?: string | null;
  grossRevenueCents: number;
  discountRevenueCents: number;
  netRevenueCents: number;
}): string[] {
  const warnings: string[] = [];

  if (input.status === "closed" && !input.closedAt) warnings.push("Missing closed_at.");
  if (input.status === "closed" && !input.closedBy?.trim()) warnings.push("Missing closed_by.");
  if (!Number.isFinite(input.volumeMl) || input.volumeMl <= 0) warnings.push("Missing volume_ml.");
  if (!Number.isFinite(input.mlConsumed) || input.mlConsumed < 0) warnings.push("Invalid ml_consumed.");
  if (!Number.isFinite(input.mermaMl) || input.mermaMl < 0) warnings.push("Invalid merma_ml.");
  if (input.volumeMl > 0 && input.mlConsumed + input.mermaMl > input.volumeMl) {
    warnings.push("Consumed plus merma exceeds volume.");
  }
  if (input.grossRevenueCents - input.discountRevenueCents !== input.netRevenueCents) {
    warnings.push("Revenue totals do not reconcile.");
  }

  return warnings;
}
