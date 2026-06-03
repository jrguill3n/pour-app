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

export interface ProductCupMlInput {
  externalProductId: string;
  cupMl?: number | null;
}

export interface OperationalLineInput {
  lineNumber: number;
  note?: string | null;
}

export interface OperationalBarrelLineInput {
  lineId: number;
  status: string;
}

export function defaultOperationalLines(count = 15): OperationalLineInput[] {
  return Array.from({ length: count }, (_, index) => {
    const lineNumber = index + 1;
    return {
      lineNumber,
      note: lineNumber === 15 ? "Nitro" : "",
    };
  });
}

export function occupiedLineNumbers(barrels: OperationalBarrelLineInput[]): number[] {
  return [
    ...new Set(
      barrels
        .filter((barrel) => barrel.status === "active")
        .map((barrel) => barrel.lineId)
    ),
  ].sort((a, b) => a - b);
}

export function canOpenLine(
  lineNumber: number,
  lines: OperationalLineInput[],
  barrels: OperationalBarrelLineInput[]
): boolean {
  return lines.some((line) => line.lineNumber === lineNumber) &&
    !occupiedLineNumbers(barrels).includes(lineNumber);
}

export function volumeLToVolumeMl(volumeL: number): number {
  return Number.isFinite(volumeL) && volumeL > 0 ? Math.round(volumeL * 1000) : 0;
}

export function volumeMlToVolumeL(volumeMl: number): number {
  return Number.isFinite(volumeMl) && volumeMl > 0 ? volumeMl / 1000 : 0;
}

export function hasConfiguredDraftCategories(categories: CategoryEligibilityInput[]): boolean {
  return categories.some((category) => category.isDraftEligible);
}

export function isPositiveCupMl(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function findMappedProductsMissingCupMl(
  externalProductIds: string[],
  products: ProductCupMlInput[],
  cupMlByExternalProductId: Record<string, number>
): string[] {
  const productCupMl = new Map(products.map((product) => [product.externalProductId, product.cupMl]));

  return externalProductIds.filter((externalProductId) => {
    const submittedCupMl = cupMlByExternalProductId[externalProductId];
    const storedCupMl = productCupMl.get(externalProductId);
    return !isPositiveCupMl(submittedCupMl) && !isPositiveCupMl(storedCupMl);
  });
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
