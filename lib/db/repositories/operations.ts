import { and, desc, eq, sql } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import type { POSProvider } from "@/lib/pos/types";
import {
  activeBarrelMovedAuditEvent,
  chooseContext,
  DEMO_CONTEXT,
  defaultOperationalLines,
  filterProductsByEligibleCategories,
  hasRealConnectedAccount,
  hasConfiguredDraftCategories,
  normalizeOperationalBarrelEdit,
  reserveActivatedAuditEvent,
  reserveCreatedAuditEvent,
  volumeLToVolumeMl,
} from "./operations-boundary";
import { validateBarrelClose } from "@/lib/core/barrel-close";

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
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
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

export interface OperationalLine {
  id: string;
  merchantId: string;
  posProvider: string;
  lineNumber: number;
  note: string | null;
}

export interface OperationalBarrel {
  id: string;
  merchantId: string;
  posProvider: string;
  lineId: number | null;
  kegId: string | null;
  brand: string | null;
  groupName: string | null;
  beerStyle: string | null;
  abvBasisPoints: number | null;
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
  openedAt: string | null;
  openedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
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
  lines: OperationalLine[];
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

function lineEntityId(context: OperationalContext, lineNumber: number): string {
  return `${context.posProvider}:${context.merchantId}:line:${lineNumber}`;
}

function barrelEntityId(context: OperationalContext, lineId: number, openedAt: Date): string {
  return `${context.posProvider}:${context.merchantId}:barrel:${lineId}:${openedAt.getTime()}`;
}

function reserveBarrelEntityId(context: OperationalContext, createdAt: Date): string {
  return `${context.posProvider}:${context.merchantId}:reserve:${createdAt.getTime()}`;
}

let postgresBarrelInsertSchemaChecked = false;

async function ensurePostgresBarrelInsertSchema() {
  if (postgresBarrelInsertSchemaChecked) return;

  const runtime = getDatabase();

  if (runtime.dialect !== "postgres") {
    postgresBarrelInsertSchemaChecked = true;
    return;
  }

  await runtime.db.execute(sql`
    do $$
    begin
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'barrels'
          and column_name = 'external_product_ids'
          and udt_name = '_uuid'
      ) then
        alter table public.barrels
          alter column external_product_ids type text[]
          using external_product_ids::text[];
      end if;
      alter table public.barrels
        alter column line_id drop not null;
      alter table public.barrels
        alter column opened_at drop not null;
    end $$;
  `);
  postgresBarrelInsertSchemaChecked = true;
}

async function ensureDefaultLines(context: OperationalContext) {
  const runtime = getDatabase();
  const now = new Date();
  const lines = defaultOperationalLines();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.lines)
      .values(
        lines.map((line) => ({
          id: lineEntityId(context, line.lineNumber),
          merchantId: context.merchantId,
          posProvider: context.posProvider,
          lineNumber: line.lineNumber,
          note: line.note,
          raw: { source: "local-default" },
          updatedAt: now,
        }))
      )
      .onConflictDoNothing();
    return;
  }

  await runtime.db
    .insert(sqlite.lines)
    .values(
      lines.map((line) => ({
        id: lineEntityId(context, line.lineNumber),
        merchantId: context.merchantId,
        posProvider: context.posProvider,
        lineNumber: line.lineNumber,
        note: line.note,
        raw: { source: "local-default" },
        updatedAt: now,
      }))
    )
    .onConflictDoNothing();
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
    await ensureDefaultLines(context);
    const [productRows, categoryRows, lineRows, barrelRows, logRows] = await Promise.all([
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
        .from(pg.lines)
        .where(and(eq(pg.lines.merchantId, context.merchantId), eq(pg.lines.posProvider, context.posProvider)))
        .orderBy(pg.lines.lineNumber),
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
        autoSyncEnabled: row.autoSyncEnabled,
        syncIntervalMinutes: row.syncIntervalMinutes,
        lastSyncAt: toIso(row.lastSyncAt),
        nextSyncAt: toIso(row.nextSyncAt),
        lastSyncStatus: row.lastSyncStatus,
        lastSyncError: row.lastSyncError,
        updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
      })),
      products,
      mappingProducts,
      productCategories,
      draftCategoriesConfigured,
      lines: lineRows.map((row) => ({
        id: row.id,
        merchantId: row.merchantId,
        posProvider: row.posProvider,
        lineNumber: row.lineNumber,
        note: row.note,
      })),
      barrels: barrelRows.map((row) => ({
        id: row.id,
        merchantId: row.merchantId,
        posProvider: row.posProvider,
        lineId: row.lineId,
        kegId: row.kegId,
        brand: row.brand,
        groupName: row.groupName,
        beerStyle: row.beerStyle,
        abvBasisPoints: row.abv,
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
        openedAt: toIso(row.openedAt),
        openedBy: row.openedBy,
        closedAt: toIso(row.closedAt),
        closedBy: row.closedBy,
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
  await ensureDefaultLines(context);
  const [productRows, categoryRows, lineRows, barrelRows, logRows] = await Promise.all([
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
      .from(sqlite.lines)
      .where(and(eq(sqlite.lines.merchantId, context.merchantId), eq(sqlite.lines.posProvider, context.posProvider)))
      .orderBy(sqlite.lines.lineNumber),
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
      autoSyncEnabled: row.autoSyncEnabled,
      syncIntervalMinutes: row.syncIntervalMinutes,
      lastSyncAt: toIso(row.lastSyncAt),
      nextSyncAt: toIso(row.nextSyncAt),
      lastSyncStatus: row.lastSyncStatus,
      lastSyncError: row.lastSyncError,
      updatedAt: toIso(row.updatedAt) ?? new Date().toISOString(),
    })),
    products,
    mappingProducts,
    productCategories,
    draftCategoriesConfigured,
    lines: lineRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      lineNumber: row.lineNumber,
      note: row.note,
    })),
    barrels: barrelRows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      lineId: row.lineId,
      kegId: row.kegId,
      brand: row.brand,
      groupName: row.groupName,
      beerStyle: row.beerStyle,
      abvBasisPoints: row.abv,
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
      openedAt: toIso(row.openedAt),
      openedBy: row.openedBy,
      closedAt: toIso(row.closedAt),
      closedBy: row.closedBy,
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

export interface CreateOperationalBarrelInput {
  lineId: number;
  brand: string;
  groupName: string;
  beerStyle?: string | null;
  abv?: number | null;
  externalProductIds: string[];
  volumeL: number;
  pricePaid: number;
  openedBy?: string | null;
}

export interface CreateReserveBarrelInput {
  brand?: string | null;
  groupName?: string | null;
  beerStyle?: string | null;
  abv?: number | null;
  externalProductIds?: string[];
  volumeL?: number | null;
  pricePaid?: number | null;
  createdBy?: string | null;
  notes?: string | null;
}

export interface UpdateOperationalBarrelInput {
  brand?: string | null;
  groupName?: string | null;
  beerStyle?: string | null;
  abv?: number | null;
  externalProductIds?: string[];
  volumeL?: number | null;
  pricePaid?: number | null;
  openedBy?: string | null;
}

export interface CloseOperationalBarrelInput {
  mermaMl: number;
  closedBy: string;
  closedAt?: Date;
}

export interface MoveOperationalBarrelInput {
  destinationLineId: number;
  movedBy: string;
  movedAt?: Date;
}

export interface ActivateReserveBarrelInput {
  destinationLineId: number;
  openedBy: string;
  openedAt?: Date;
}

function rawRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function appendMoveEvent(
  raw: unknown,
  event:
    | ReturnType<typeof activeBarrelMovedAuditEvent>
    | ReturnType<typeof reserveCreatedAuditEvent>
    | ReturnType<typeof reserveActivatedAuditEvent>
) {
  const nextRaw = rawRecord(raw);
  const existingEvents = Array.isArray(nextRaw.audit_events)
    ? nextRaw.audit_events
    : Array.isArray(nextRaw.move_events)
      ? nextRaw.move_events
      : [];
  const auditEvents = [...existingEvents, event];

  return {
    ...nextRaw,
    source: nextRaw.source ?? "pour-local",
    audit_events: auditEvents,
    move_events: auditEvents,
    last_audit_event: event,
    last_move_event: event,
  };
}

function appendEditMetadata(raw: unknown, input: UpdateOperationalBarrelInput) {
  return {
    ...rawRecord(raw),
    source: "pour-local-edit",
    last_edit_input: input,
  };
}

export async function createOperationalBarrel(
  context: OperationalContext,
  input: CreateOperationalBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const openedAt = new Date();
  const id = barrelEntityId(context, input.lineId, openedAt);
  const kegId = `KEG-${openedAt.getFullYear()}-${String(openedAt.getTime()).slice(-6)}`;
  const values = {
    id,
    merchantId: context.merchantId,
    posProvider: context.posProvider,
    lineId: input.lineId,
    kegId,
    brand: input.brand,
    groupName: input.groupName,
    beerStyle: input.beerStyle ?? null,
    abv: input.abv ? Math.round(input.abv * 100) : null,
    externalProductIds: input.externalProductIds,
    volumeMl: volumeLToVolumeMl(input.volumeL),
    pricePaidCents: Math.round(input.pricePaid * 100),
    mlConsumed: 0,
    mermaMl: 0,
    revenueBrutoCents: 0,
    revenueDescuentosCents: 0,
    revenueNetoCents: 0,
    status: "active",
    openedAt,
    openedBy: input.openedBy ?? null,
    raw: { source: "pour-local", input },
    updatedAt: openedAt,
  };

  await ensureDefaultLines(context);

  if (runtime.dialect === "postgres") {
    await ensurePostgresBarrelInsertSchema();

    const existing = await runtime.db
      .select({ id: pg.barrels.id })
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider),
          eq(pg.barrels.lineId, input.lineId),
          eq(pg.barrels.status, "active")
        )
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("line_already_occupied");
    }

    await runtime.db.insert(pg.barrels).values(values);
    return getOperationalSnapshot(context.posProvider);
  }

  const existing = await runtime.db
    .select({ id: sqlite.barrels.id })
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider),
        eq(sqlite.barrels.lineId, input.lineId),
        eq(sqlite.barrels.status, "active")
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error("line_already_occupied");
  }

  await runtime.db.insert(sqlite.barrels).values(values);
  return getOperationalSnapshot(context.posProvider);
}

export async function createReserveOperationalBarrel(
  context: OperationalContext,
  input: CreateReserveBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const createdAt = new Date();
  const createdBy = input.createdBy?.trim() || "No registrado";
  const id = reserveBarrelEntityId(context, createdAt);
  const kegId = `RES-${createdAt.getFullYear()}-${String(createdAt.getTime()).slice(-6)}`;
  const reserveEvent = reserveCreatedAuditEvent({ user: createdBy, createdAt });
  const values = {
    id,
    merchantId: context.merchantId,
    posProvider: context.posProvider,
    lineId: null,
    kegId,
    brand: input.brand?.trim() || null,
    groupName: input.groupName?.trim() || null,
    beerStyle: input.beerStyle?.trim() || null,
    abv: input.abv && Number.isFinite(input.abv) ? Math.round(input.abv * 100) : null,
    externalProductIds: input.externalProductIds ?? [],
    volumeMl:
      typeof input.volumeL === "number" && Number.isFinite(input.volumeL) && input.volumeL > 0
        ? volumeLToVolumeMl(input.volumeL)
        : 0,
    pricePaidCents:
      typeof input.pricePaid === "number" && Number.isFinite(input.pricePaid) && input.pricePaid >= 0
        ? Math.round(input.pricePaid * 100)
        : null,
    mlConsumed: 0,
    mermaMl: 0,
    revenueBrutoCents: 0,
    revenueDescuentosCents: 0,
    revenueNetoCents: 0,
    status: "reserve",
    openedAt: null,
    openedBy: null,
    raw: {
      source: "pour-local-reserve",
      notes: input.notes?.trim() || null,
      audit_events: [reserveEvent],
      move_events: [reserveEvent],
      last_audit_event: reserveEvent,
      last_move_event: reserveEvent,
    },
    updatedAt: createdAt,
  };

  if (runtime.dialect === "postgres") {
    await ensurePostgresBarrelInsertSchema();
    await runtime.db.insert(pg.barrels).values(values);
    return getOperationalSnapshot(context.posProvider);
  }

  await runtime.db.insert(sqlite.barrels).values(values);
  return getOperationalSnapshot(context.posProvider);
}

export async function updateOperationalBarrel(
  context: OperationalContext,
  barrelId: string,
  input: UpdateOperationalBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const now = new Date();
  const normalized = normalizeOperationalBarrelEdit({
    pricePaid: input.pricePaid,
    volumeL: input.volumeL,
    openedBy: input.openedBy,
  });
  const baseValues = {
    ...(input.brand !== undefined ? { brand: input.brand } : {}),
    ...(input.groupName !== undefined ? { groupName: input.groupName } : {}),
    ...(input.beerStyle !== undefined ? { beerStyle: input.beerStyle } : {}),
    ...(input.abv !== undefined
      ? { abv: typeof input.abv === "number" && Number.isFinite(input.abv) ? Math.round(input.abv * 100) : null }
      : {}),
    ...(input.externalProductIds !== undefined ? { externalProductIds: input.externalProductIds } : {}),
    ...(input.volumeL !== undefined ? { volumeMl: normalized.volumeMl ?? 0 } : {}),
    ...(input.pricePaid !== undefined ? { pricePaidCents: normalized.pricePaidCents } : {}),
    ...(input.openedBy !== undefined ? { openedBy: normalized.openedBy } : {}),
    updatedAt: now,
  };

  if (runtime.dialect === "postgres") {
    const [current] = await runtime.db
      .select({ raw: pg.barrels.raw })
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      )
      .limit(1);

    await runtime.db
      .update(pg.barrels)
      .set({ ...baseValues, raw: appendEditMetadata(current?.raw, input) })
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      );
    return getOperationalSnapshot(context.posProvider);
  }

  const [current] = await runtime.db
    .select({ raw: sqlite.barrels.raw })
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    )
    .limit(1);

  await runtime.db
    .update(sqlite.barrels)
    .set({ ...baseValues, raw: appendEditMetadata(current?.raw, input) })
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    );
  return getOperationalSnapshot(context.posProvider);
}

export async function moveOperationalBarrel(
  context: OperationalContext,
  barrelId: string,
  input: MoveOperationalBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const movedAt = input.movedAt ?? new Date();
  const destinationLineId = input.destinationLineId;
  const movedBy = input.movedBy.trim();

  if (!Number.isInteger(destinationLineId) || destinationLineId <= 0) {
    throw new Error("invalid_destination_line");
  }

  if (!movedBy) {
    throw new Error("moved_by_required");
  }

  await ensureDefaultLines(context);

  if (runtime.dialect === "postgres") {
    const [current] = await runtime.db
      .select()
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      )
      .limit(1);

    if (!current) throw new Error("barrel_not_found");
    if (current.status !== "active") throw new Error("barrel_move_inactive");
    if (current.lineId === destinationLineId) throw new Error("barrel_move_same_line");

    const destinationLine = await runtime.db
      .select({ id: pg.lines.id })
      .from(pg.lines)
      .where(
        and(
          eq(pg.lines.merchantId, context.merchantId),
          eq(pg.lines.posProvider, context.posProvider),
          eq(pg.lines.lineNumber, destinationLineId)
        )
      )
      .limit(1);

    if (destinationLine.length === 0) throw new Error("destination_line_not_found");

    const occupied = await runtime.db
      .select({ id: pg.barrels.id })
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider),
          eq(pg.barrels.lineId, destinationLineId),
          eq(pg.barrels.status, "active")
        )
      )
      .limit(1);

    if (occupied.length > 0) throw new Error("destination_line_occupied");

    const event = activeBarrelMovedAuditEvent({
      fromLine: current.lineId,
      toLine: destinationLineId,
      user: movedBy,
      movedAt,
    });

    await runtime.db
      .update(pg.barrels)
      .set({
        lineId: destinationLineId,
        raw: appendMoveEvent(current.raw, event),
        updatedAt: movedAt,
      })
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      );
    return getOperationalSnapshot(context.posProvider);
  }

  const [current] = await runtime.db
    .select()
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    )
    .limit(1);

  if (!current) throw new Error("barrel_not_found");
  if (current.status !== "active") throw new Error("barrel_move_inactive");
  if (current.lineId === destinationLineId) throw new Error("barrel_move_same_line");

  const destinationLine = await runtime.db
    .select({ id: sqlite.lines.id })
    .from(sqlite.lines)
    .where(
      and(
        eq(sqlite.lines.merchantId, context.merchantId),
        eq(sqlite.lines.posProvider, context.posProvider),
        eq(sqlite.lines.lineNumber, destinationLineId)
      )
    )
    .limit(1);

  if (destinationLine.length === 0) throw new Error("destination_line_not_found");

  const occupied = await runtime.db
    .select({ id: sqlite.barrels.id })
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider),
        eq(sqlite.barrels.lineId, destinationLineId),
        eq(sqlite.barrels.status, "active")
      )
    )
    .limit(1);

  if (occupied.length > 0) throw new Error("destination_line_occupied");

  const event = activeBarrelMovedAuditEvent({
    fromLine: current.lineId,
    toLine: destinationLineId,
    user: movedBy,
    movedAt,
  });

  await runtime.db
    .update(sqlite.barrels)
    .set({
      lineId: destinationLineId,
      raw: appendMoveEvent(current.raw, event),
      updatedAt: movedAt,
    })
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    );
  return getOperationalSnapshot(context.posProvider);
}

export async function activateReserveOperationalBarrel(
  context: OperationalContext,
  barrelId: string,
  input: ActivateReserveBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const openedAt = input.openedAt ?? new Date();
  const destinationLineId = input.destinationLineId;
  const openedBy = input.openedBy.trim();

  if (!Number.isInteger(destinationLineId) || destinationLineId <= 0) {
    throw new Error("invalid_destination_line");
  }

  if (!openedBy) {
    throw new Error("opened_by_required");
  }

  await ensureDefaultLines(context);

  if (runtime.dialect === "postgres") {
    await ensurePostgresBarrelInsertSchema();
    const [current] = await runtime.db
      .select()
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      )
      .limit(1);

    if (!current) throw new Error("barrel_not_found");
    if (current.status !== "reserve") throw new Error("barrel_activate_not_reserve");

    const destinationLine = await runtime.db
      .select({ id: pg.lines.id })
      .from(pg.lines)
      .where(
        and(
          eq(pg.lines.merchantId, context.merchantId),
          eq(pg.lines.posProvider, context.posProvider),
          eq(pg.lines.lineNumber, destinationLineId)
        )
      )
      .limit(1);

    if (destinationLine.length === 0) throw new Error("destination_line_not_found");

    const occupied = await runtime.db
      .select({ id: pg.barrels.id })
      .from(pg.barrels)
      .where(
        and(
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider),
          eq(pg.barrels.lineId, destinationLineId),
          eq(pg.barrels.status, "active")
        )
      )
      .limit(1);

    if (occupied.length > 0) throw new Error("destination_line_occupied");

    const event = reserveActivatedAuditEvent({
      toLine: destinationLineId,
      user: openedBy,
      activatedAt: openedAt,
    });

    await runtime.db
      .update(pg.barrels)
      .set({
        lineId: destinationLineId,
        status: "active",
        openedAt,
        openedBy,
        raw: appendMoveEvent(current.raw, event),
        updatedAt: openedAt,
      })
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      );
    return getOperationalSnapshot(context.posProvider);
  }

  const [current] = await runtime.db
    .select()
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    )
    .limit(1);

  if (!current) throw new Error("barrel_not_found");
  if (current.status !== "reserve") throw new Error("barrel_activate_not_reserve");

  const destinationLine = await runtime.db
    .select({ id: sqlite.lines.id })
    .from(sqlite.lines)
    .where(
      and(
        eq(sqlite.lines.merchantId, context.merchantId),
        eq(sqlite.lines.posProvider, context.posProvider),
        eq(sqlite.lines.lineNumber, destinationLineId)
      )
    )
    .limit(1);

  if (destinationLine.length === 0) throw new Error("destination_line_not_found");

  const occupied = await runtime.db
    .select({ id: sqlite.barrels.id })
    .from(sqlite.barrels)
    .where(
      and(
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider),
        eq(sqlite.barrels.lineId, destinationLineId),
        eq(sqlite.barrels.status, "active")
      )
    )
    .limit(1);

  if (occupied.length > 0) throw new Error("destination_line_occupied");

  const event = reserveActivatedAuditEvent({
    toLine: destinationLineId,
    user: openedBy,
    activatedAt: openedAt,
  });

  await runtime.db
    .update(sqlite.barrels)
    .set({
      lineId: destinationLineId,
      status: "active",
      openedAt,
      openedBy,
      raw: appendMoveEvent(current.raw, event),
      updatedAt: openedAt,
    })
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    );
  return getOperationalSnapshot(context.posProvider);
}

export async function closeOperationalBarrel(
  context: OperationalContext,
  barrelId: string,
  input: CloseOperationalBarrelInput
): Promise<OperationalSnapshot> {
  const runtime = getDatabase();
  const closedAt = input.closedAt ?? new Date();

  const currentRows = runtime.dialect === "postgres"
    ? await runtime.db
        .select()
        .from(pg.barrels)
        .where(
          and(
            eq(pg.barrels.id, barrelId),
            eq(pg.barrels.merchantId, context.merchantId),
            eq(pg.barrels.posProvider, context.posProvider)
          )
        )
        .limit(1)
    : await runtime.db
        .select()
        .from(sqlite.barrels)
        .where(
          and(
            eq(sqlite.barrels.id, barrelId),
            eq(sqlite.barrels.merchantId, context.merchantId),
            eq(sqlite.barrels.posProvider, context.posProvider)
          )
        )
        .limit(1);

  const current = currentRows[0];
  if (!current) throw new Error("barrel_not_found");

  const validation = validateBarrelClose({
    status: current.status,
    volumeMl: current.volumeMl,
    mlConsumed: current.mlConsumed,
    mermaMl: input.mermaMl,
    grossRevenueCents: current.revenueBrutoCents,
    discountRevenueCents: current.revenueDescuentosCents,
    netRevenueCents: current.revenueNetoCents,
    openedAt: current.openedAt ?? closedAt,
    closedAt,
    closedBy: input.closedBy,
  });

  if (!validation.ok || !validation.summary) {
    throw new Error(`barrel_close_invalid:${validation.errors.join("|")}`);
  }

  const values = {
    status: "closed",
    mermaMl: validation.summary.mermaMl,
    yieldPct: validation.summary.finalYieldPctBasisPoints,
    closedAt,
    closedBy: input.closedBy.trim(),
    raw: {
      source: "pour-local-close",
      close_summary: validation.summary,
    },
    updatedAt: closedAt,
  };

  if (runtime.dialect === "postgres") {
    await runtime.db
      .update(pg.barrels)
      .set(values)
      .where(
        and(
          eq(pg.barrels.id, barrelId),
          eq(pg.barrels.merchantId, context.merchantId),
          eq(pg.barrels.posProvider, context.posProvider)
        )
      );
    return getOperationalSnapshot(context.posProvider);
  }

  await runtime.db
    .update(sqlite.barrels)
    .set(values)
    .where(
      and(
        eq(sqlite.barrels.id, barrelId),
        eq(sqlite.barrels.merchantId, context.merchantId),
        eq(sqlite.barrels.posProvider, context.posProvider)
      )
    );

  return getOperationalSnapshot(context.posProvider);
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
