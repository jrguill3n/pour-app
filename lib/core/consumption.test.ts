import { describe, expect, it } from "vitest";
import { calculateBarrelConsumption } from "./consumption";

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
});
