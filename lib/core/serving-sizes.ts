interface ServingSizeProductNameInput {
  name: string;
  variant_name?: string | null;
  parent_product_name?: string | null;
}

export function defaultDraftCupMlForProduct(product: ServingSizeProductNameInput): number | null {
  const text = [product.variant_name, product.name, product.parent_product_name]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();

  if (text.includes("JARRA")) return 1000;
  if (text.includes("PINTA")) return 355;
  if (text.includes("SAMPLER")) return 150;

  return null;
}
