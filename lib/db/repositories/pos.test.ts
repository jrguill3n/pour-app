import { describe, expect, it } from "vitest";
import { defaultDraftCupMlForProduct } from "../../core/serving-sizes";

describe("defaultDraftCupMlForProduct", () => {
  it("defaults PINTA products to 355ml", () => {
    expect(defaultDraftCupMlForProduct({ name: "PINTA BROWN" })).toBe(355);
  });

  it("defaults JARRA products to 1000ml", () => {
    expect(defaultDraftCupMlForProduct({ name: "JARRA", variant_name: "JAR. TINY" })).toBe(1000);
  });

  it("defaults SAMPLER products to 150ml", () => {
    expect(defaultDraftCupMlForProduct({ name: "SAMPLER STOUT" })).toBe(150);
  });

  it("uses variant and parent context when matching serving-size text", () => {
    expect(
      defaultDraftCupMlForProduct({
        name: "BROWN",
        variant_name: "PINTA BROWN",
        parent_product_name: "PINTA INSURGENTE",
      })
    ).toBe(355);
  });

  it("does not default unrelated products", () => {
    expect(defaultDraftCupMlForProduct({ name: "BURGER" })).toBeNull();
  });
});
