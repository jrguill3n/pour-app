import { describe, expect, it } from "vitest";
import { calculateBarrelConsumption, formatLiters, getConsumedPct } from "./consumption";

const barrels = [
  { id: "barrel-1", externalProductIds: ["poster-product-1", "poster-product-2"] },
  { id: "barrel-2", externalProductIds: ["poster-product-3"] },
];

describe("calculateBarrelConsumption", () => {
  it("matches sale line items to active barrels by external product id", () => {
    const totals = calculateBarrelConsumption(
      barrels,
      [
        {
          id: "sale-1",
          gross_cents: 15000,
          discount_cents: 1000,
          net_cents: 14000,
          line_items: [
            {
              external_product_id: "poster-product-1",
              quantity: 2,
              gross_cents: 10000,
              discount_cents: 500,
              net_cents: 9500,
            },
            {
              external_product_id: "poster-product-3",
              quantity: 1,
              gross_cents: 5000,
              discount_cents: 500,
              net_cents: 4500,
            },
          ],
        },
      ],
      {
        "poster-product-1": 355,
        "poster-product-3": 1000,
      }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 710,
      revenue_bruto_cents: 10000,
      revenue_descuentos_cents: 500,
      revenue_neto_cents: 9500,
    });
    expect(totals["barrel-2"]).toEqual({
      ml_consumed: 1000,
      revenue_bruto_cents: 5000,
      revenue_descuentos_cents: 500,
      revenue_neto_cents: 4500,
    });
  });

  it("calculates consumption when cup_ml is configured", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-brown"] }],
      [
        {
          id: "sale-1",
          gross_cents: 24000,
          discount_cents: 0,
          net_cents: 24000,
          line_items: [{ external_product_id: "pinta-brown", quantity: 3, gross_cents: 24000 }],
        },
      ],
      { "pinta-brown": 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 1065,
      revenue_bruto_cents: 24000,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 24000,
    });
  });

  it("counts full-price pints as volume and net revenue", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta"] }],
      [
        {
          id: "full-price",
          gross_cents: 12000,
          discount_cents: 0,
          net_cents: 12000,
          line_items: [{ external_product_id: "pinta", quantity: 1, gross_cents: 12000, net_cents: 12000 }],
        },
      ],
      { pinta: 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 355,
      revenue_bruto_cents: 12000,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 12000,
    });
  });

  it("counts discounted pints as full volume with discounted net revenue", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta"] }],
      [
        {
          id: "discounted",
          gross_cents: 12000,
          discount_cents: 6000,
          net_cents: 6000,
          line_items: [
            { external_product_id: "pinta", quantity: 1, gross_cents: 12000, discount_cents: 6000, net_cents: 6000 },
          ],
        },
      ],
      { pinta: 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 355,
      revenue_bruto_cents: 12000,
      revenue_descuentos_cents: 6000,
      revenue_neto_cents: 6000,
    });
  });

  it("counts free comped pints as volume with zero net revenue", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta"] }],
      [
        {
          id: "comped",
          gross_cents: 12000,
          discount_cents: 12000,
          net_cents: 0,
          line_items: [
            { external_product_id: "pinta", quantity: 1, gross_cents: 12000, discount_cents: 12000, net_cents: 0 },
          ],
        },
      ],
      { pinta: 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 355,
      revenue_bruto_cents: 12000,
      revenue_descuentos_cents: 12000,
      revenue_neto_cents: 0,
    });
  });

  it("does not count transactions before the barrel opened", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-03T02:01:18.000Z" }],
      [
        {
          id: "old-sale",
          created_at: "2026-05-27T23:48:25.000Z",
          gross_cents: 12000,
          discount_cents: 0,
          net_cents: 12000,
          line_items: [{ external_product_id: "pinta-lupulosa", quantity: 32, gross_cents: 384000 }],
        },
      ],
      { "pinta-lupulosa": 355 }
    );

    expect(totals["barrel-1"].ml_consumed).toBe(0);
    expect(totals["barrel-1"].revenue_bruto_cents).toBe(0);
  });

  it("counts transactions after the barrel opened", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-03T02:01:18.000Z" }],
      [
        {
          id: "new-sale",
          created_at: "2026-06-03T02:05:00.000Z",
          gross_cents: 12000,
          discount_cents: 0,
          net_cents: 12000,
          line_items: [{ external_product_id: "pinta-lupulosa", quantity: 1, gross_cents: 12000 }],
        },
      ],
      { "pinta-lupulosa": 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 355,
      revenue_bruto_cents: 12000,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 12000,
    });
  });

  it("does not overcount timezone-offset sales before opened_at", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-03T02:01:18.000Z" }],
      [
        {
          id: "edge-sale",
          created_at: "2026-06-02T20:00:00-06:00",
          gross_cents: 12000,
          discount_cents: 0,
          net_cents: 12000,
          line_items: [{ external_product_id: "pinta-lupulosa", quantity: 1, gross_cents: 12000 }],
        },
      ],
      { "pinta-lupulosa": 355 }
    );

    expect(totals["barrel-1"].ml_consumed).toBe(0);
  });

  it("ignores mapped sales when cup_ml is missing", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-brown"] }],
      [
        {
          id: "sale-1",
          gross_cents: 8000,
          discount_cents: 0,
          net_cents: 8000,
          line_items: [{ external_product_id: "pinta-brown", quantity: 1, gross_cents: 8000 }],
        },
      ],
      {}
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 0,
      revenue_bruto_cents: 0,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 0,
    });
  });

  it("returns zero metrics when there are no sales", () => {
    const totals = calculateBarrelConsumption(
      [{ id: "barrel-1", externalProductIds: ["pinta-brown"] }],
      [],
      { "pinta-brown": 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 0,
      revenue_bruto_cents: 0,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 0,
    });
  });

  it("formats invalid or empty consumption values as safe zeroes", () => {
    expect(getConsumedPct(Number.NaN, 20000)).toBe(0);
    expect(formatLiters(Number.NaN)).toBe("0ml");
    expect(formatLiters(0)).toBe("0ml");
  });

  it("ignores refunded and voided sales", () => {
    const totals = calculateBarrelConsumption(
      barrels,
      [
        {
          id: "refunded",
          gross_cents: 10000,
          discount_cents: 0,
          net_cents: 10000,
          is_refunded: true,
          line_items: [
            {
              external_product_id: "poster-product-1",
              quantity: 2,
              gross_cents: 10000,
            },
          ],
        },
        {
          id: "voided",
          gross_cents: 10000,
          discount_cents: 0,
          net_cents: 10000,
          is_voided: true,
          line_items: [
            {
              external_product_id: "poster-product-1",
              quantity: 2,
              gross_cents: 10000,
            },
          ],
        },
      ],
      { "poster-product-1": 355 }
    );

    expect(totals["barrel-1"]).toEqual({
      ml_consumed: 0,
      revenue_bruto_cents: 0,
      revenue_descuentos_cents: 0,
      revenue_neto_cents: 0,
    });
  });

  it("allocates transaction-level discounts across matched line items", () => {
    const totals = calculateBarrelConsumption(
      barrels,
      [
        {
          id: "discounted-sale",
          gross_cents: 20000,
          discount_cents: 2000,
          net_cents: 18000,
          line_items: [
            {
              external_product_id: "poster-product-1",
              quantity: 1,
              gross_cents: 10000,
            },
            {
              external_product_id: "poster-product-3",
              quantity: 1,
              gross_cents: 10000,
            },
          ],
        },
      ],
      {
        "poster-product-1": 355,
        "poster-product-3": 1000,
      }
    );

    expect(totals["barrel-1"].revenue_descuentos_cents).toBe(1000);
    expect(totals["barrel-1"].revenue_neto_cents).toBe(9000);
    expect(totals["barrel-2"].revenue_descuentos_cents).toBe(1000);
    expect(totals["barrel-2"].revenue_neto_cents).toBe(9000);
  });

  it("is deterministic when recalculated from the same normalized sales", () => {
    const sales = [
      {
        id: "sale-1",
        gross_cents: 10000,
        discount_cents: 0,
        net_cents: 10000,
        line_items: [
          {
            external_product_id: "poster-product-1",
            quantity: 1,
            gross_cents: 10000,
          },
        ],
      },
    ];
    const cupMap = { "poster-product-1": 355 };

    expect(calculateBarrelConsumption(barrels, sales, cupMap)).toEqual(
      calculateBarrelConsumption(barrels, sales, cupMap)
    );
  });

  it("keeps consumption continuous when a barrel moves lines", () => {
    const sales = [
      {
        id: "before-move",
        created_at: "2026-06-16T02:31:00.000Z",
        gross_cents: 12000,
        discount_cents: 0,
        net_cents: 12000,
        line_items: [{ external_product_id: "pinta-lupulosa", quantity: 1, gross_cents: 12000 }],
      },
      {
        id: "after-move",
        created_at: "2026-06-16T02:40:00.000Z",
        gross_cents: 12000,
        discount_cents: 0,
        net_cents: 12000,
        line_items: [{ external_product_id: "pinta-lupulosa", quantity: 1, gross_cents: 12000 }],
      },
    ];

    expect(
      calculateBarrelConsumption(
        [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-16T02:30:00.000Z" }],
        sales,
        { "pinta-lupulosa": 355 }
      )
    ).toEqual(
      calculateBarrelConsumption(
        [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-16T02:30:00.000Z" }],
        sales,
        { "pinta-lupulosa": 355 }
      )
    );
    expect(
      calculateBarrelConsumption(
        [{ id: "barrel-1", externalProductIds: ["pinta-lupulosa"], opened_at: "2026-06-16T02:30:00.000Z" }],
        sales,
        { "pinta-lupulosa": 355 }
      )["barrel-1"].ml_consumed
    ).toBe(710);
  });
});
