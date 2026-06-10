import { describe, expect, it } from "vitest";
import {
  canOpenLine,
  chooseContext,
  DEMO_CONTEXT,
  defaultOperationalLines,
  filterProductsByEligibleCategories,
  findMappedProductsMissingCupMl,
  hasConfiguredDraftCategories,
  hasRealConnectedAccount,
  normalizeOperationalBarrelEdit,
  occupiedLineNumbers,
  volumeLToVolumeMl,
  volumeMlToVolumeL,
} from "./operations-boundary";

describe("operational demo/real boundary", () => {
  const demoAccount = {
    merchantId: "mock-merchant",
    posProvider: "mock",
  };
  const posterAccount = {
    merchantId: "624548",
    posProvider: "poster",
  };

  it("uses demo context only when no account exists", () => {
    expect(chooseContext([])).toEqual(DEMO_CONTEXT);
  });

  it("prefers a real POS account over seeded demo data", () => {
    expect(chooseContext([demoAccount, posterAccount])).toEqual({
      merchantId: "624548",
      posProvider: "poster",
    });
  });

  it("allows explicit demo mode when requested", () => {
    expect(chooseContext([demoAccount, posterAccount], "mock")).toEqual(DEMO_CONTEXT);
  });

  it("detects connected real accounts separately from mock demo accounts", () => {
    expect(hasRealConnectedAccount([demoAccount])).toBe(false);
    expect(hasRealConnectedAccount([demoAccount, posterAccount])).toBe(true);
  });

  it("shows all products until draft categories are configured", () => {
    const products = [
      { externalProductId: "1", externalCategoryId: "food" },
      { externalProductId: "2", externalCategoryId: "draft" },
    ];

    expect(hasConfiguredDraftCategories([{ externalCategoryId: "draft", isDraftEligible: false }])).toBe(false);
    expect(filterProductsByEligibleCategories(products, [])).toEqual(products);
    expect(
      filterProductsByEligibleCategories(products, [{ externalCategoryId: "draft", isDraftEligible: false }])
    ).toEqual(products);
  });

  it("filters mapping candidates by eligible external category id", () => {
    const products = [
      { externalProductId: "burger", externalCategoryId: "food" },
      { externalProductId: "pint", externalCategoryId: "draft-national" },
      { externalProductId: "shirt", externalCategoryId: "merch" },
    ];

    expect(
      filterProductsByEligibleCategories(products, [
        { externalCategoryId: "food", isDraftEligible: false },
        { externalCategoryId: "draft-national", isDraftEligible: true },
      ])
    ).toEqual([{ externalProductId: "pint", externalCategoryId: "draft-national" }]);
  });

  it("allows mapped products when cup_ml is already configured", () => {
    expect(
      findMappedProductsMissingCupMl(
        ["pinta-brown"],
        [{ externalProductId: "pinta-brown", cupMl: 355 }],
        {}
      )
    ).toEqual([]);
  });

  it("allows mapped products when cup_ml is submitted with the mapping save", () => {
    expect(
      findMappedProductsMissingCupMl(
        ["pinta-brown"],
        [{ externalProductId: "pinta-brown", cupMl: null }],
        { "pinta-brown": 355 }
      )
    ).toEqual([]);
  });

  it("rejects mapped products without cup_ml", () => {
    expect(
      findMappedProductsMissingCupMl(
        ["pinta-brown", "pinta-tiny"],
        [
          { externalProductId: "pinta-brown", cupMl: 0 },
          { externalProductId: "pinta-tiny", cupMl: null },
        ],
        {}
      )
    ).toEqual(["pinta-brown", "pinta-tiny"]);
  });

  it("creates a default local line setup for real merchants without demo data", () => {
    const lines = defaultOperationalLines();

    expect(lines).toHaveLength(15);
    expect(lines[0]).toEqual({ lineNumber: 1, note: "" });
    expect(lines[14]).toEqual({ lineNumber: 15, note: "Nitro" });
  });

  it("allows opening a real merchant line when no barrels exist", () => {
    const lines = defaultOperationalLines();
    const barrels: Array<{ lineId: number; status: string }> = [];

    expect(occupiedLineNumbers(barrels)).toEqual([]);
    expect(canOpenLine(1, lines, barrels)).toBe(true);
  });

  it("blocks opening an already occupied line but leaves empty lines available", () => {
    const lines = defaultOperationalLines();
    const barrels = [{ lineId: 1, status: "active" }];

    expect(occupiedLineNumbers(barrels)).toEqual([1]);
    expect(canOpenLine(1, lines, barrels)).toBe(false);
    expect(canOpenLine(2, lines, barrels)).toBe(true);
  });

  it("round-trips a 20L barrel as 20000ml for persistence and rendering", () => {
    expect(volumeLToVolumeMl(20)).toBe(20000);
    expect(volumeMlToVolumeL(20000)).toBe(20);
  });

  it("normalizes edited barrel cost, volume, and opener for persistence", () => {
    expect(
      normalizeOperationalBarrelEdit({
        pricePaid: 3018,
        volumeL: 20,
        openedBy: "  Ramon  ",
      })
    ).toEqual({
      pricePaidCents: 301800,
      volumeMl: 20000,
      openedBy: "Ramon",
    });
  });

  it("normalizes a 30L edit as 30000ml", () => {
    expect(normalizeOperationalBarrelEdit({ volumeL: 30 })).toMatchObject({
      volumeMl: 30000,
    });
  });
});
