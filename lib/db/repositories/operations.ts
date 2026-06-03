import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import type { POSProvider } from "@/lib/pos/types";
import {
  chooseContext,
  DEMO_CONTEXT,
  filterProductsByEligibleCategories,
  hasRealConnectedAccount,
  hasConfiguredDraftCategories,
} from "./operations-boundary";

export { chooseContext, DEMO_CONTEXT, filterProductsByEligibleCategories, hasRealConnectedAccount };

export interface OperationalContext {
  merchantId: string;
  posProvider: POSProvider;
}

export interface OperationalAccount {
  id: string;
  merchantId: string;
  posProvider: string;
  posAccountId: string;
  connected: boolean;
  tokenExpiresAt: string | null;
  updatedAt: string;
}

export interface OperationalProduct {
  id: string;
  merchantId: string;
  posProvider: string;
  externalProductId: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  externalCategoryId: string | null;
  parentExternalProductId: string | null;
  parentProductName: string | null;
  variantExternalId: string | null;
  variantName: string | null;
  cupMl: number | null;
  priceCents: number | null;
}

export interface OperationalProductCategory {
  id: string;
  merchantId: string;
  posProvider: string;
  externalCategoryId: string;
  name: string;
  isDraftEligible: boolean;
}

export interface OperationalBarrel {
  id: string;
  merchantId: string;
  posProvider: string;
  lineId: number;
  kegId: string | null;
  brand: string | null;
  groupName: string | null;
  externalProductIds: string[];
  volumeMl: number;
  pricePaidCents: number | null;
  mlConsumed: number;
  mermaMl: number;
  yieldPctBasisPoints: number | null;
  revenueBrutoCents: number;
  revenueDescuentosCents: number;
  revenueNetoCents: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

export interface OperationalPollingLog {
  id: string;
  merchantId: string;
  posProvider: string;
  dataType: string;
  lastPolledAt: string | null;
  lastSyncedAt: string | null;
  raw: unknown;
  updatedAt: string;
}

export interface OperationalSnapshot {
  context: OperationalContext;
  mode: "demo" | "connected";
  accounts: OperationalAccount[];
  products: OperationalProduct[];
  mappingProducts: OperationalProduct[];
  productCategories: OperationalProductCategory[];
  draftCategoriesConfigured: boolean;
  barrels: OperationalBarrel[];
  logs: OperationalPollingLog[];
}

function toIso(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function productIds(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function countValue(row: { count: unknown } | undefined): number {
  const value = row?.count;
  return typeof value === "number" ? value : Number(value ?? 0);
}

function categoryEntityId(posProvider: string, merchantId: string, externalCategoryId: string): string {
  return `${posProvider}:${merchantId}:category:${externalCategoryId}`;
}

function rawValue(raw: unknown, key: string): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

function rowExternalCategoryId(row: {
  categoryId: string | null;
  externalCategoryId: string | null;
  raw: unknown;
}): string | null {
  return row.externalCategoryId ?? row.categoryId ?? rawValue(row.raw, "menu_category_id");
}

function rowCategoryName(row: {
  categoryName: string | null;
  raw: unknown;
}): string | null {
  return row.categoryName ?? rawValue(row.raw, "category_name");
}

function mergeProductCategories(
  context: OperationalContext,
  productRows: Array<{
    categoryId: string | null;
    categoryName: string | null;
    externalCategoryId: string | null;
    raw: unknown;
  }>,
  categoryRows: Array<{
    id: string;
    merchantId: string;
    posProvider: string;
    externalCategoryId: string;
    name: string;
    isDraftEligible: boolean;
  }>
): OperationalProductCategory[] {
  const categories = new Map<string, OperationalProductCategory>();

  for (const row of productRows) {
    const externalCategoryId = rowExternalCategoryId(row);
    const name = rowCategoryName(row);

    if (!externalCategoryId || !name) continue;

    categories.set(externalCategoryId, {
      id: categoryEntityId(context.posProvider, context.merchantId, externalCategoryId),
      merchantId: context.merchantId,
      posProvider: context.posProvider,
      externalCategoryId,
      name,
      isDraftEligible: false,
    });
  }

  for (const row of categoryRows) {
    categories.set(row.externalCategoryId, {
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      externalCategoryId: row.externalCategoryId,
      name: row.name,
      isDraftEligible: row.isDraftEligible,
    });
  }

  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getOperationalSnapshot(
  preferredProvider?: POSProvider
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const accountRows = await runtime.db.select().from(pg.accounts);
    const context = chooseContext(accountRows, preferredProvider);
    const [productRows, categoryRows, barrelRows, logRows] = await Promise.all([
      runtime.db
        .select()
        .from(pg.products)
        .where(and(eq(pg.products.merchantId, context.merchantId), eq(pg.products.posProvider, context.posProvider))),
      runtime.db
        .select()
        .from(pg.posProductCategories)
        .where(
          and(
            eq(pg.posProductCategories.merchantId, context.merchantId),
            eq(pg.posProductCategories.posProvider, context.posProvider)
          )
        )
        .orderBy(pg.posProductCategories.name),
      runtime.db
        .select()
        .from(pg.barrels)
        .where(and(eq(pg.barrels.merchantId, context.merchantId), eq(pg.barrels.posProvider, context.posProvider)))
        .orderBy(desc(pg.barrels.openedAt)),
      runtime.db
        .select()
        .from(pg.pollingLogs)
        .where(and(eq(pg.pollingLogs.merchantId, context.merchantId), eq(pg.pollingLogs.posProvider, context.posProvider)))
        .orderBy(desc(pg.pollingLogs.updatedAt)),
    ]);
    const [totalProducts, productsForMerchant624548] = await Promise.all([
      runtime.db.select({ count: sql<number>`count(*)` }).from(pg.products),
      runtime.db
        .select({ count: sql<number>`count(*)` })
        .from(pg.products)
        .where(eq(pg.products.merchantId, "624548")),
    ]);

    console.info("Operational product diagnostics.", {
      dialect: runtime.dialect,
      context,
      totalProductsInDb: countValue(totalProducts[0]),
      productsForMerchant624548: countValue(productsForMerchant624548[0]),
      productsReturnedToSelector: productRows.length,
    });
    const products = productRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      externalProductId: row.externalProductId,
      name: row.name,
      categoryId: row.categoryId,
      categoryName: rowCategoryName(row),
      externalCategoryId: rowExternalCategoryId(row),
      parentExternalProductId: row.parentExternalProductId,
      parentProductName: row.parentProductName,
      variantExternalId: row.variantExternalId,
      variantName: row.variantName,
      cupMl: row.cupMl,
      priceCents: row.priceCents,
    }));
    const productCategories = mergeProductCategories(context, productRows, categoryRows);
    const draftCategoriesConfigured = hasConfiguredDraftCategories(productCategories);
    const mappingProducts = filterProductsByEligibleCategories(products, productCategories);

    return {
      context,
      mode: hasRealConnectedAccount(accountRows) ? "connected" : "demo",
      accounts: accountRows.map((row) => ({
        id: row.id,
        merchantId: row.merchantId,
        posProvider: row.posProvider,
        posAccountId: row.posAccountId,
        connected: Boolean(row.accessToken),
        tokenExpiresAt: toIso(row.tokenExpiresAt),
        updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
      })),
      products,
      mappingProducts,
      productCategories,
      draftCategoriesConfigured,
      barrels: barrelRows.map((row) => ({
        id: row.id,
        merchantId: row.merchantId,
        posProvider: row.posProvider,
        lineId: row.lineId,
        kegId: row.kegId,
        brand: row.brand,
        groupName: row.groupName,
        externalProductIds: productIds(row.externalProductIds),
        volumeMl: row.volumeMl,
        pricePaidCents: row.pricePaidCents,
        mlConsumed: row.mlConsumed,
        mermaMl: row.mermaMl,
        yieldPctBasisPoints: row.yieldPct,
        revenueBrutoCents: row.revenueBrutoCents,
        revenueDescuentosCents: row.revenueDescuentosCents,
        revenueNetoCents: row.revenueNetoCents,
        status: row.status,
        openedAt: toIso(row.openedAt) ?? new Date().toISOString(),
        closedAt: toIso(row.closedAt),
      })),
      logs: logRows.map((row) => ({
        id: row.id,
        merchantId: row.merchantId,
        posProvider: row.posProvider,
        dataType: row.dataType,
        lastPolledAt: toIso(row.lastPolledAt),
        lastSyncedAt: toIso(row.lastSyncedAt),
        raw: row.raw,
        updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
      })),
    };
  }

  const accountRows = await runtime.db.select().from(sqlite.accounts);
  const context = chooseContext(accountRows, preferredProvider);
  const [productRows, categoryRows, barrelRows, logRows] = await Promise.all([
    runtime.db
      .select()
      .from(sqlite.products)
      .where(and(eq(sqlite.products.merchantId, context.merchantId), eq(sqlite.products.posProvider, context.posProvider))),
    runtime.db
      .select()
      .from(sqlite.posProductCategories)
      .where(
        and(
          eq(sqlite.posProductCategories.merchantId, context.merchantId),
          eq(sqlite.posProductCategories.posProvider, context.posProvider)
        )
      )
      .orderBy(sqlite.posProductCategories.name),
    runtime.db
      .select()
      .from(sqlite.barrels)
      .where(and(eq(sqlite.barrels.merchantId, context.merchantId), eq(sqlite.barrels.posProvider, context.posProvider)))
      .orderBy(desc(sqlite.barrels.openedAt)),
    runtime.db
      .select()
      .from(sqlite.pollingLogs)
      .where(and(eq(sqlite.pollingLogs.merchantId, context.merchantId), eq(sqlite.pollingLogs.posProvider, context.posProvider)))
      .orderBy(desc(sqlite.pollingLogs.updatedAt)),
  ]);
  const [totalProducts, productsForMerchant624548] = await Promise.all([
    runtime.db.select({ count: sql<number>`count(*)` }).from(sqlite.products),
    runtime.db
      .select({ count: sql<number>`count(*)` })
      .from(sqlite.products)
      .where(eq(sqlite.products.merchantId, "624548")),
  ]);

  console.info("Operational product diagnostics.", {
    dialect: runtime.dialect,
    context,
    totalProductsInDb: countValue(totalProducts[0]),
    productsForMerchant624548: countValue(productsForMerchant624548[0]),
    productsReturnedToSelector: productRows.length,
  });
  const products = productRows.map((row) => ({
    id: row.id,
    merchantId: row.merchantId,
    posProvider: row.posProvider,
    externalProductId: row.externalProductId,
    name: row.name,
    categoryId: row.categoryId,
    categoryName: rowCategoryName(row),
    externalCategoryId: rowExternalCategoryId(row),
    parentExternalProductId: row.parentExternalProductId,
    parentProductName: row.parentProductName,
    variantExternalId: row.variantExternalId,
    variantName: row.variantName,
    cupMl: row.cupMl,
    priceCents: row.priceCents,
  }));
  const productCategories = mergeProductCategories(context, productRows, categoryRows);
  const draftCategoriesConfigured = hasConfiguredDraftCategories(productCategories);
  const mappingProducts = filterProductsByEligibleCategories(products, productCategories);

  return {
    context,
    mode: hasRealConnectedAccount(accountRows) ? "connected" : "demo",
    accounts: accountRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      posAccountId: row.posAccountId,
      connected: Boolean(row.accessToken),
      tokenExpiresAt: toIso(row.tokenExpiresAt),
      updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    })),
    products,
    mappingProducts,
    productCategories,
    draftCategoriesConfigured,
    barrels: barrelRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      lineId: row.lineId,
      kegId: row.kegId,
      brand: row.brand,
      groupName: row.groupName,
      externalProductIds: productIds(row.externalProductIds),
      volumeMl: row.volumeMl,
      pricePaidCents: row.pricePaidCents,
      mlConsumed: row.mlConsumed,
      mermaMl: row.mermaMl,
      yieldPctBasisPoints: row.yieldPct,
      revenueBrutoCents: row.revenueBrutoCents,
      revenueDescuentosCents: row.revenueDescuentosCents,
      revenueNetoCents: row.revenueNetoCents,
      status: row.status,
      openedAt: toIso(row.openedAt) ?? new Date().toISOString(),
      closedAt: toIso(row.closedAt),
    })),
    logs: logRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      dataType: row.dataType,
      lastPolledAt: toIso(row.lastPolledAt),
      lastSyncedAt: toIso(row.lastSyncedAt),
      raw: row.raw,
      updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    })),
  };
}

export async function saveBarrelProductMapping(
  context: OperationalContext,
  barrelId: string,
  externalProductIds: string[]
) {
  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .update(pg.barrels)
      .set({ externalProductIds, updatedAt: now })
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      );
    return;
  }

  await runtime.db
    .update(sqlite.barrels)
    .set({ externalProductIds, updatedAt: now })
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    );
}

export async function saveProductCupMlMapping(
  context: OperationalContext,
  externalProductId: string,
  cupMl: number
) {
  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .update(pg.products)
      .set({ cupMl, updatedAt: now })
      .where(
        and(
          eq(pg.products.merchantId, context.merchantId),
          eq(pg.products.posProvider, context.posProvider),
          eq(pg.products.externalProductId, externalProductId)
        )
      );
    return;
  }

  await runtime.db
    .update(sqlite.products)
    .set({ cupMl, updatedAt: now })
    .where(
      and(
        eq(sqlite.products.merchantId, context.merchantId),
        eq(sqlite.products.posProvider, context.posProvider),
        eq(sqlite.products.externalProductId, externalProductId)
      )
    );
}

export async function saveDraftCategoryEligibility(
  context: OperationalContext,
  categories: Array<{ externalCategoryId: string; name: string; isDraftEligible: boolean }>
) {
  const runtime = getDatabase();
  const now = new Date();

  if (categories.length === 0) return;

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.posProductCategories)
      .values(
        categories.map((category) => ({
          id: categoryEntityId(context.posProvider, context.merchantId, category.externalCategoryId),
          merchantId: context.merchantId,
          posProvider: context.posProvider,
          externalCategoryId: category.externalCategoryId,
          name: category.name,
          isDraftEligible: category.isDraftEligible,
          updatedAt: now,
        }))
      )
      .onConflictDoUpdate({
        target: [
          pg.posProductCategories.merchantId,
          pg.posProductCategories.posProvider,
          pg.posProductCategories.externalCategoryId,
        ],
        set: {
          name: sql`excluded.name`,
          isDraftEligible: sql`excluded.is_draft_eligible`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.posProductCategories)
    .values(
      categories.map((category) => ({
        id: categoryEntityId(context.posProvider, context.merchantId, category.externalCategoryId),
        merchantId: context.merchantId,
        posProvider: context.posProvider,
        externalCategoryId: category.externalCategoryId,
        name: category.name,
        isDraftEligible: category.isDraftEligible,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: [
        sqlite.posProductCategories.merchantId,
        sqlite.posProductCategories.posProvider,
        sqlite.posProductCategories.externalCategoryId,
      ],
      set: {
        name: sql`excluded.name`,
        isDraftEligible: sql`excluded.is_draft_eligible`,
        updatedAt: now,
      },
    });
}

export async function appendSyncFailureLog(
  context: OperationalContext,
  dataType: string,
  error: string
) {
  const runtime = getDatabase();
  const now = new Date();
  const id = `${context.merchantId}:${context.posProvider}:${dataType}:error:${now.getTime()}`;
  const raw = { status: "error", error, completed_at: now.toISOString() };

  if (runtime.dialect === "postgres") {
    await runtime.db.insert(pg.pollingLogs).values({
      id,
      merchantId: context.merchantId,
      posProvider: context.posProvider,
      dataType,
      lastPolledAt: now,
      raw,
      updatedAt: now,
    });
    return;
  }

  await runtime.db.insert(sqlite.pollingLogs).values({
    id,
    merchantId: context.merchantId,
    posProvider: context.posProvider,
    dataType,
    lastPolledAt: now,
    raw,
    updatedAt: now,
  });
}

export async function markDemoSync(context: OperationalContext) {
  const runtime = getDatabase();
  const now = new Date();
  const id = `${context.merchantId}:${context.posProvider}:manual-sync`;
  const raw = {
    status: "completed",
    mode: "demo",
    transactions_processed: 0,
    completed_at: now.toISOString(),
  };

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.pollingLogs)
      .values({
        id,
        merchantId: context.merchantId,
        posProvider: context.posProvider,
        dataType: "manual-sync",
        lastPolledAt: now,
        lastSyncedAt: now,
        raw,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pg.pollingLogs.merchantId, pg.pollingLogs.posProvider, pg.pollingLogs.dataType],
        set: {
          lastPolledAt: sql`excluded.last_polled_at`,
          lastSyncedAt: sql`excluded.last_synced_at`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.pollingLogs)
    .values({
      id,
      merchantId: context.merchantId,
      posProvider: context.posProvider,
      dataType: "manual-sync",
      lastPolledAt: now,
      lastSyncedAt: now,
      raw,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [sqlite.pollingLogs.merchantId, sqlite.pollingLogs.posProvider, sqlite.pollingLogs.dataType],
      set: {
        lastPolledAt: sql`excluded.last_polled_at`,
        lastSyncedAt: sql`excluded.last_synced_at`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    });
}
