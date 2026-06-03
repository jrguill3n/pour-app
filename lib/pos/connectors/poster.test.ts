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
    });
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
