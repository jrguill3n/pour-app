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

export interface ReserveActivationInput {
  externalProductIds: string[];
}

export interface OperationalLineInput {
  lineNumber: number;
  note?: string | null;
}

export interface OperationalBarrelLineInput {
  lineId: number;
  status: string;
}

export interface SyncableActiveBarrelInput {
  status: string;
  lineId: number | null;
  openedAt: unknown | null;
}

export interface OperationalBarrelEditInput {
  pricePaid?: number | null;
  volumeL?: number | null;
  openedBy?: string | null;
}

export interface ActiveBarrelMovedAuditEvent {
  event: "active_barrel_moved";
  from_line: number | null;
  to_line: number;
  timestamp: string;
  user: string;
  message: string;
}

export interface ReserveCreatedAuditEvent {
  event: "reserve_created";
  from_line: null;
  to_line: null;
  timestamp: string;
  user: string;
  message: string;
}

export interface ReserveActivatedAuditEvent {
  event: "reserve_activated";
  from_line: null;
  to_line: number;
  timestamp: string;
  user: string;
  message: string;
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

export function isSyncableActiveBarrel<T extends SyncableActiveBarrelInput>(
  barrel: T
): barrel is T & { lineId: number; openedAt: Exclude<T["openedAt"], null> } {
  return barrel.status === "active" && barrel.lineId !== null && barrel.openedAt !== null;
}

export function canOpenLine(
  lineNumber: number,
  lines: OperationalLineInput[],
  barrels: OperationalBarrelLineInput[]
): boolean {
  return lines.some((line) => line.lineNumber === lineNumber) &&
    !occupiedLineNumbers(barrels).includes(lineNumber);
}

export function availableMoveDestinationLines(
  sourceLineNumber: number,
  lines: OperationalLineInput[],
  barrels: OperationalBarrelLineInput[]
): OperationalLineInput[] {
  const occupied = new Set(occupiedLineNumbers(barrels));

  return lines.filter((line) => line.lineNumber !== sourceLineNumber && !occupied.has(line.lineNumber));
}

export function activeBarrelMovedAuditEvent(input: {
  fromLine: number | null;
  toLine: number;
  user: string;
  movedAt: Date;
}): ActiveBarrelMovedAuditEvent {
  const timestamp = input.movedAt.toISOString();

  return {
    event: "active_barrel_moved",
    from_line: input.fromLine,
    to_line: input.toLine,
    timestamp,
    user: input.user,
    message: `Moved from Line ${input.fromLine ?? "reserve"} to Line ${input.toLine} by ${input.user} at ${timestamp}`,
  };
}

export function reserveActivationErrors(
  reserve: ReserveActivationInput,
  products: ProductCupMlInput[]
): string[] {
  if (reserve.externalProductIds.length === 0) {
    return ["linked_product_required"];
  }

  const missingCupMl = findMappedProductsMissingCupMl(reserve.externalProductIds, products, {});
  return missingCupMl.length > 0 ? ["cup_ml_required"] : [];
}

export function reserveCreatedAuditEvent(input: {
  user: string;
  createdAt: Date;
}): ReserveCreatedAuditEvent {
  const timestamp = input.createdAt.toISOString();

  return {
    event: "reserve_created",
    from_line: null,
    to_line: null,
    timestamp,
    user: input.user,
    message: `Reserve barrel created by ${input.user} at ${timestamp}`,
  };
}

export function reserveActivatedAuditEvent(input: {
  toLine: number;
  user: string;
  activatedAt: Date;
}): ReserveActivatedAuditEvent {
  const timestamp = input.activatedAt.toISOString();

  return {
    event: "reserve_activated",
    from_line: null,
    to_line: input.toLine,
    timestamp,
    user: input.user,
    message: `Reserve barrel activated on Line ${input.toLine} by ${input.user} at ${timestamp}`,
  };
}

export function volumeLToVolumeMl(volumeL: number): number {
  return Number.isFinite(volumeL) && volumeL > 0 ? Math.round(volumeL * 1000) : 0;
}

export function volumeMlToVolumeL(volumeMl: number): number {
  return Number.isFinite(volumeMl) && volumeMl > 0 ? volumeMl / 1000 : 0;
}

export function normalizeOperationalBarrelEdit(input: OperationalBarrelEditInput) {
  return {
    pricePaidCents:
      typeof input.pricePaid === "number" && Number.isFinite(input.pricePaid)
        ? Math.round(input.pricePaid * 100)
        : null,
    volumeMl:
      typeof input.volumeL === "number" && Number.isFinite(input.volumeL)
        ? volumeLToVolumeMl(input.volumeL)
        : null,
    openedBy: input.openedBy?.trim() || null,
  };
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
