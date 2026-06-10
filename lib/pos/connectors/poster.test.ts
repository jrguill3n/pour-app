import { describe, expect, it } from "vitest";
import { normalizePosterProducts, normalizePosterSale } from "./poster";

describe("Poster variant normalization", () => {
  const parentProduct = {
    product_id: "23",
    product_name: "PINTA INSURGENTE",
    menu_category_id: "8",
    category_name: "DRAFT NACIONAL",
    modifications: [
      {
        modificator_id: "414",
        modificator_name: "PINTA BROWN",
        spots: [{ spot_id: "1", price: "11500", visible: "1" }],
      },
      {
        modificator_id: "415",
        modificator_name: "PINTA TINY",
        spots: [{ spot_id: "1", price: "12000", visible: "1" }],
      },
    ],
  };

  it("normalizes Poster modifications as sellable variant products", () => {
    const products = normalizePosterProducts(parentProduct, "624548");

    expect(products.map((product) => product.external_product_id)).toEqual([
      "23",
      "23:414",
      "23:415",
    ]);
    expect(products[1]).toMatchObject({
      name: "PINTA BROWN",
      parent_external_product_id: "23",
      parent_product_name: "PINTA INSURGENTE",
      variant_external_id: "414",
      variant_name: "PINTA BROWN",
      external_category_id: "8",
      category_name: "DRAFT NACIONAL",
      price_cents: 1150000,
    });
  });

  it("normalizes transaction line items using the same variant id convention", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "sale-1",
        date_created: "2026-06-03T00:00:00Z",
        products: [
          {
            product_id: "23",
            modification_id: "414",
            num: "2",
            product_sum: "230.00",
          },
        ],
      },
      "624548"
    );

    expect(sale.line_items[0]).toMatchObject({
      external_product_id: "23:414",
      quantity: 2,
      unit_price_cents: 11500,
      gross_cents: 23000,
      net_cents: 23000,
    });
  });

  it("uses product_sum as gross and payed_sum as actual collected revenue", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "sale-discount",
        date_close: "2026-06-03 10:00:00",
        products: [
          {
            product_id: "23",
            modification_id: "414",
            num: "1",
            product_sum: "120.00",
            payed_sum: "60.00",
          },
          {
            product_id: "23",
            modification_id: "415",
            num: "1",
            product_sum: "120.00",
            payed_sum: "0.00",
          },
        ],
      },
      "624548"
    );

    expect(sale.line_items[0]).toMatchObject({
      external_product_id: "23:414",
      gross_cents: 12000,
      discount_cents: 6000,
      net_cents: 6000,
    });
    expect(sale.line_items[1]).toMatchObject({
      external_product_id: "23:415",
      gross_cents: 12000,
      discount_cents: 12000,
      net_cents: 0,
    });
    expect(sale).toMatchObject({
      gross_cents: 24000,
      discount_cents: 18000,
      net_cents: 6000,
    });
  });

  it("normalizes a full-price pint from Poster check line fields", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "full-price",
        date_close: "2026-06-03 10:00:00",
        products: [
          {
            product_id: "23",
            modification_id: "486",
            product_name: "PINTA LUPULOSA",
            num: 1,
            product_sum: "120.00",
            payed_sum: "120.00",
            discount: 0,
          },
        ],
      },
      "624548"
    );

    expect(sale.line_items[0]).toMatchObject({
      external_product_id: "23:486",
      quantity: 1,
      gross_cents: 12000,
      discount_cents: 0,
      net_cents: 12000,
    });
    expect(sale).toMatchObject({
      gross_cents: 12000,
      discount_cents: 0,
      net_cents: 12000,
    });
  });

  it("normalizes a discounted pint from Poster check line fields", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "discounted",
        date_close: "2026-06-03 10:00:00",
        products: [
          {
            product_id: "23",
            modification_id: "486",
            product_name: "PINTA LUPULOSA",
            num: 1,
            product_sum: "120.00",
            payed_sum: "80.00",
            discount: 0,
          },
        ],
      },
      "624548"
    );

    expect(sale.line_items[0]).toMatchObject({
      external_product_id: "23:486",
      quantity: 1,
      gross_cents: 12000,
      discount_cents: 4000,
      net_cents: 8000,
    });
    expect(sale).toMatchObject({
      gross_cents: 12000,
      discount_cents: 4000,
      net_cents: 8000,
    });
  });

  it("normalizes a free comped pint with zero collected revenue", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "comped",
        date_close: "2026-06-02 21:22:16",
        products: [
          {
            product_id: "23",
            modification_id: "486",
            product_name: "PINTA LUPULOSA",
            num: 1,
            product_sum: "120.00",
            payed_sum: "0.00",
            discount: 0,
          },
        ],
      },
      "624548"
    );

    expect(sale.line_items[0]).toMatchObject({
      external_product_id: "23:486",
      quantity: 1,
      gross_cents: 12000,
      discount_cents: 12000,
      net_cents: 0,
    });
    expect(sale).toMatchObject({
      gross_cents: 12000,
      discount_cents: 12000,
      net_cents: 0,
      created_at: "2026-06-03T03:22:16.000Z",
    });
  });

  it("marks refunded and voided Poster transactions so consumption ignores them", () => {
    const refunded = normalizePosterSale(
      {
        transaction_id: "refunded",
        status: "refund",
        products: [{ product_id: "23", modification_id: "486", num: 1, product_sum: "120.00" }],
      },
      "624548"
    );
    const voided = normalizePosterSale(
      {
        transaction_id: "voided",
        canceled: "1",
        products: [{ product_id: "23", modification_id: "486", num: 1, product_sum: "120.00" }],
      },
      "624548"
    );

    expect(refunded.is_refunded).toBe(true);
    expect(voided.is_voided).toBe(true);
  });

  it("uses Poster date_close as the normalized sale timestamp", () => {
    const sale = normalizePosterSale(
      {
        transaction_id: "sale-2",
        date_close: "2026-05-27 23:48:25",
        products: [],
      },
      "624548"
    );

    expect(sale.created_at).toBe("2026-05-28T05:48:25.000Z");
  });
});
