import type { POSProvider } from "../../pos/types";

export interface OperationalContextInput {
  merchantId: string;
  posProvider: string;
}

export const DEMO_CONTEXT = {
  merchantId: "mock-merchant",
  posProvider: "mock",
} satisfies { merchantId: string; posProvider: POSProvider };

export function hasRealConnectedAccount(accounts: Array<{ posProvider: string }>): boolean {
  return accounts.some((account) => account.posProvider !== "mock");
}

export function chooseContext(
  accounts: OperationalContextInput[],
  preferredProvider?: POSProvider
) {
  const preferred = preferredProvider
    ? accounts.find((account) => account.posProvider === preferredProvider)
    : accounts.find((account) => account.posProvider !== "mock") ?? accounts[0];

  if (!preferred) return DEMO_CONTEXT;

  return {
    merchantId: preferred.merchantId,
    posProvider: preferred.posProvider as POSProvider,
  };
}

export interface CategoryEligibilityInput {
  externalCategoryId: string;
  isDraftEligible: boolean;
}

export interface ProductCategoryInput {
  externalProductId: string;
  externalCategoryId?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  parentExternalProductId?: string | null;
  variantExternalId?: string | null;
}

export function hasConfiguredDraftCategories(categories: CategoryEligibilityInput[]): boolean {
  return categories.some((category) => category.isDraftEligible);
}

export function filterProductsByEligibleCategories<T extends ProductCategoryInput>(
  products: T[],
  categories: CategoryEligibilityInput[]
): T[] {
  const parentIdsWithVariants = new Set(
    products
      .map((product) => product.parentExternalProductId)
      .filter((parentId): parentId is string => Boolean(parentId))
  );
  const eligibleCategoryIds = new Set(
    categories
      .filter((category) => category.isDraftEligible)
      .map((category) => category.externalCategoryId)
  );

  const sellableProducts = products.filter(
    (product) => !parentIdsWithVariants.has(product.externalProductId)
  );

  if (eligibleCategoryIds.size === 0) return sellableProducts;

  return sellableProducts.filter((product) => {
    const externalCategoryId = product.externalCategoryId ?? product.categoryId;
    return Boolean(externalCategoryId && eligibleCategoryIds.has(externalCategoryId));
  });
}
