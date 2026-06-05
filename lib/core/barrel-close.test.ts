import { describe, expect, it } from "vitest";
import { closedBarrelHistoryWarnings, validateBarrelClose } from "./barrel-close";

describe("barrel close validation", () => {
  it("accepts a reconciled close payload", () => {
    const result = validateBarrelClose({
      status: "active",
      volumeMl: 20000,
      mlConsumed: 710,
      mermaMl: 19000,
      grossRevenueCents: 24000,
      discountRevenueCents: 12000,
      netRevenueCents: 12000,
      openedAt: "2026-06-03T02:01:18.000Z",
      closedAt: "2026-06-05T02:01:18.000Z",
      closedBy: "Carlos V.",
    });

    expect(result.ok).toBe(true);
    expect(result.summary?.finalYieldPctBasisPoints).toBe(9855);
  });

  it("rejects invalid merma and unreconciled revenue", () => {
    const result = validateBarrelClose({
      status: "active",
      volumeMl: 20000,
      mlConsumed: 5000,
      mermaMl: 18000,
      grossRevenueCents: 24000,
      discountRevenueCents: 10000,
      netRevenueCents: 12000,
      openedAt: "2026-06-03T02:01:18.000Z",
      closedAt: "2026-06-05T02:01:18.000Z",
      closedBy: "",
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("ml_consumed plus merma_ml cannot exceed barrel volume.");
    expect(result.errors).toContain("closed_by is required.");
    expect(result.errors).toContain("gross revenue minus discounts must equal net revenue.");
  });
});

describe("closed barrel history warnings", () => {
  it("flags missing close metadata and impossible totals", () => {
    expect(
      closedBarrelHistoryWarnings({
        status: "closed",
        volumeMl: 20000,
        mlConsumed: 19000,
        mermaMl: 2000,
        closedAt: null,
        closedBy: null,
        grossRevenueCents: 24000,
        discountRevenueCents: 12000,
        netRevenueCents: 10000,
      })
    ).toEqual([
      "Missing closed_at.",
      "Missing closed_by.",
      "Consumed plus merma exceeds volume.",
      "Revenue totals do not reconcile.",
    ]);
  });
});
