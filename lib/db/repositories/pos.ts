import { eq, and, sql, gte } from "drizzle-orm";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import type {
  NormalizedEmployee,
  NormalizedLocation,
  NormalizedProduct,
  NormalizedSale,
  POSProvider,
} from "@/lib/pos/types";

export interface PersistenceContext {
  merchantId: string;
  posProvider?: POSProvider;
}

export interface ActiveBarrelRecord {
  id: string;
  merchantId: string;
  posProvider: string;
  locationId: string | null;
  lineId: number;
  kegId: string | null;
  brand: string | null;
  groupName: string | null;
  externalProductIds: string[] | null;
  volumeMl: number;
  pricePaidCents: number | null;
  mlConsumed: number;
  mermaMl: number;
  status: string;
  openedAt: Date;
}

export interface StoredSaleForConsumption {
  id: string;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  is_refunded: boolean;
  is_voided: boolean;
  line_items: NormalizedSale["line_items"];
}

function providerFor(context: PersistenceContext, provider?: POSProvider): string {
  return provider ?? context.posProvider ?? "mock";
}

function entityId(provider: string, merchantId: string, externalId: string): string {
  return `${provider}:${merchantId}:${externalId}`;
}

function saleCreatedAt(createdAt: string): Date {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

export async function saveProducts(context: PersistenceContext, products: NormalizedProduct[]) {
  if (products.length === 0) return;

  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.products)
      .values(
        products.map((product) => {
          const posProvider = providerFor(context, product.pos_provider);
          return {
            id: product.id || entityId(posProvider, context.merchantId, product.external_product_id),
            merchantId: product.merchant_id ?? context.merchantId,
            posProvider,
            externalProductId: product.external_product_id,
            name: product.name,
            description: product.description ?? null,
            categoryId: product.category_id ?? null,
            priceCents: product.price_cents ?? null,
            cupMl: product.cup_ml ?? null,
            raw: product.raw ?? null,
            updatedAt: now,
          };
        })
      )
      .onConflictDoUpdate({
        target: [pg.products.merchantId, pg.products.posProvider, pg.products.externalProductId],
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          categoryId: sql`excluded.category_id`,
          priceCents: sql`excluded.price_cents`,
          cupMl: sql`excluded.cup_ml`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.products)
    .values(
      products.map((product) => {
        const posProvider = providerFor(context, product.pos_provider);
        return {
          id: product.id || entityId(posProvider, context.merchantId, product.external_product_id),
          merchantId: product.merchant_id ?? context.merchantId,
          posProvider,
          externalProductId: product.external_product_id,
          name: product.name,
          description: product.description ?? null,
          categoryId: product.category_id ?? null,
          priceCents: product.price_cents ?? null,
          cupMl: product.cup_ml ?? null,
          raw: product.raw ?? null,
          updatedAt: now,
        };
      })
    )
    .onConflictDoUpdate({
      target: [sqlite.products.merchantId, sqlite.products.posProvider, sqlite.products.externalProductId],
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        categoryId: sql`excluded.category_id`,
        priceCents: sql`excluded.price_cents`,
        cupMl: sql`excluded.cup_ml`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    });
}

export async function saveLocations(context: PersistenceContext, locations: NormalizedLocation[]) {
  if (locations.length === 0) return;

  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.locations)
      .values(
        locations.map((location) => {
          const posProvider = providerFor(context, location.pos_provider);
          return {
            id: location.id || entityId(posProvider, context.merchantId, location.external_location_id),
            merchantId: location.merchant_id ?? context.merchantId,
            posProvider,
            externalLocationId: location.external_location_id,
            name: location.name,
            address: location.address ?? null,
            raw: location.raw ?? null,
            updatedAt: now,
          };
        })
      )
      .onConflictDoUpdate({
        target: [pg.locations.merchantId, pg.locations.posProvider, pg.locations.externalLocationId],
        set: {
          name: sql`excluded.name`,
          address: sql`excluded.address`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.locations)
    .values(
      locations.map((location) => {
        const posProvider = providerFor(context, location.pos_provider);
        return {
          id: location.id || entityId(posProvider, context.merchantId, location.external_location_id),
          merchantId: location.merchant_id ?? context.merchantId,
          posProvider,
          externalLocationId: location.external_location_id,
          name: location.name,
          address: location.address ?? null,
          raw: location.raw ?? null,
          updatedAt: now,
        };
      })
    )
    .onConflictDoUpdate({
      target: [sqlite.locations.merchantId, sqlite.locations.posProvider, sqlite.locations.externalLocationId],
      set: {
        name: sql`excluded.name`,
        address: sql`excluded.address`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    });
}

export async function saveEmployees(context: PersistenceContext, employees: NormalizedEmployee[]) {
  if (employees.length === 0) return;

  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.employees)
      .values(
        employees.map((employee) => {
          const posProvider = providerFor(context, employee.pos_provider);
          return {
            id: employee.id || entityId(posProvider, context.merchantId, employee.external_employee_id),
            merchantId: employee.merchant_id ?? context.merchantId,
            posProvider,
            externalEmployeeId: employee.external_employee_id,
            name: employee.name,
            roleId: employee.role_id ?? null,
            raw: employee.raw ?? null,
            updatedAt: now,
          };
        })
      )
      .onConflictDoUpdate({
        target: [pg.employees.merchantId, pg.employees.posProvider, pg.employees.externalEmployeeId],
        set: {
          name: sql`excluded.name`,
          roleId: sql`excluded.role_id`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.employees)
    .values(
      employees.map((employee) => {
        const posProvider = providerFor(context, employee.pos_provider);
        return {
          id: employee.id || entityId(posProvider, context.merchantId, employee.external_employee_id),
          merchantId: employee.merchant_id ?? context.merchantId,
          posProvider,
          externalEmployeeId: employee.external_employee_id,
          name: employee.name,
          roleId: employee.role_id ?? null,
          raw: employee.raw ?? null,
          updatedAt: now,
        };
      })
    )
    .onConflictDoUpdate({
      target: [sqlite.employees.merchantId, sqlite.employees.posProvider, sqlite.employees.externalEmployeeId],
      set: {
        name: sql`excluded.name`,
        roleId: sql`excluded.role_id`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    });
}

export async function saveSales(context: PersistenceContext, sales: NormalizedSale[]) {
  if (sales.length === 0) return;

  const runtime = getDatabase();
  const now = new Date();

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.normalizedSales)
      .values(
        sales.map((sale) => {
          const posProvider = providerFor(context, sale.pos_provider);
          return {
            id: sale.id || entityId(posProvider, context.merchantId, sale.external_transaction_id),
            merchantId: sale.merchant_id ?? context.merchantId,
            posProvider,
            externalTransactionId: sale.external_transaction_id,
            locationId: sale.location_id ?? null,
            employeeId: sale.employee_id ?? null,
            createdAt: saleCreatedAt(sale.created_at),
            grossCents: sale.gross_cents,
            discountCents: sale.discount_cents,
            netCents: sale.net_cents,
            isRefunded: sale.is_refunded ?? false,
            isVoided: sale.is_voided ?? false,
            status: sale.status ?? null,
            lineItems: sale.line_items,
            raw: sale.raw ?? null,
            updatedAt: now,
          };
        })
      )
      .onConflictDoUpdate({
        target: [
          pg.normalizedSales.merchantId,
          pg.normalizedSales.posProvider,
          pg.normalizedSales.externalTransactionId,
        ],
        set: {
          locationId: sql`excluded.location_id`,
          employeeId: sql`excluded.employee_id`,
          createdAt: sql`excluded.created_at`,
          grossCents: sql`excluded.gross_cents`,
          discountCents: sql`excluded.discount_cents`,
          netCents: sql`excluded.net_cents`,
          isRefunded: sql`excluded.is_refunded`,
          isVoided: sql`excluded.is_voided`,
          status: sql`excluded.status`,
          lineItems: sql`excluded.line_items`,
          raw: sql`excluded.raw`,
          updatedAt: now,
        },
      });
    return;
  }

  await runtime.db
    .insert(sqlite.normalizedSales)
    .values(
      sales.map((sale) => {
        const posProvider = providerFor(context, sale.pos_provider);
        return {
          id: sale.id || entityId(posProvider, context.merchantId, sale.external_transaction_id),
          merchantId: sale.merchant_id ?? context.merchantId,
          posProvider,
          externalTransactionId: sale.external_transaction_id,
          locationId: sale.location_id ?? null,
          employeeId: sale.employee_id ?? null,
          createdAt: saleCreatedAt(sale.created_at),
          grossCents: sale.gross_cents,
          discountCents: sale.discount_cents,
          netCents: sale.net_cents,
          isRefunded: sale.is_refunded ?? false,
          isVoided: sale.is_voided ?? false,
          status: sale.status ?? null,
          lineItems: sale.line_items,
          raw: sale.raw ?? null,
          updatedAt: now,
        };
      })
    )
    .onConflictDoUpdate({
      target: [
        sqlite.normalizedSales.merchantId,
        sqlite.normalizedSales.posProvider,
        sqlite.normalizedSales.externalTransactionId,
      ],
      set: {
        locationId: sql`excluded.location_id`,
        employeeId: sql`excluded.employee_id`,
        createdAt: sql`excluded.created_at`,
        grossCents: sql`excluded.gross_cents`,
        discountCents: sql`excluded.discount_cents`,
        netCents: sql`excluded.net_cents`,
        isRefunded: sql`excluded.is_refunded`,
        isVoided: sql`excluded.is_voided`,
        status: sql`excluded.status`,
        lineItems: sql`excluded.line_items`,
        raw: sql`excluded.raw`,
        updatedAt: now,
      },
    });
}

export async function getCupMlByExternalProductId(
  context: PersistenceContext
): Promise<Record<string, number>> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .select({
        externalProductId: pg.products.externalProductId,
        cupMl: pg.products.cupMl,
      })
      .from(pg.products)
      .where(and(eq(pg.products.merchantId, context.merchantId), eq(pg.products.posProvider, providerFor(context))));

    return Object.fromEntries(rows.filter((row) => row.cupMl).map((row) => [row.externalProductId, row.cupMl ?? 0]));
  }

  const rows = await runtime.db
    .select({
      externalProductId: sqlite.products.externalProductId,
      cupMl: sqlite.products.cupMl,
    })
    .from(sqlite.products)
    .where(and(eq(sqlite.products.merchantId, context.merchantId), eq(sqlite.products.posProvider, providerFor(context))));

  return Object.fromEntries(rows.filter((row) => row.cupMl).map((row) => [row.externalProductId, row.cupMl ?? 0]));
}

export async function saveProductCupMlMappings(
  context: PersistenceContext,
  mappings: Array<{ external_product_id: string; cup_ml: number }>
) {
  const runtime = getDatabase();
  const now = new Date();
  const posProvider = providerFor(context);

  if (mappings.length === 0) return;

  if (runtime.dialect === "postgres") {
    await Promise.all(
      mappings.map((mapping) =>
        runtime.db
          .update(pg.products)
          .set({ cupMl: mapping.cup_ml, updatedAt: now })
          .where(
            and(
              eq(pg.products.merchantId, context.merchantId),
              eq(pg.products.posProvider, posProvider),
              eq(pg.products.externalProductId, mapping.external_product_id)
            )
          )
      )
    );
    return;
  }

  await Promise.all(
    mappings.map((mapping) =>
      runtime.db
        .update(sqlite.products)
        .set({ cupMl: mapping.cup_ml, updatedAt: now })
        .where(
          and(
            eq(sqlite.products.merchantId, context.merchantId),
            eq(sqlite.products.posProvider, posProvider),
            eq(sqlite.products.externalProductId, mapping.external_product_id)
          )
        )
    )
  );
}

export async function getSalesForConsumption(
  context: PersistenceContext,
  since: Date
): Promise<StoredSaleForConsumption[]> {
  const runtime = getDatabase();
  const posProvider = providerFor(context);

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .select()
      .from(pg.normalizedSales)
      .where(
        and(
          eq(pg.normalizedSales.merchantId, context.merchantId),
          eq(pg.normalizedSales.posProvider, posProvider),
          gte(pg.normalizedSales.createdAt, since)
        )
      );

    return rows.map((row) => ({
      id: row.id,
      gross_cents: row.grossCents,
      discount_cents: row.discountCents,
      net_cents: row.netCents,
      is_refunded: row.isRefunded,
      is_voided: row.isVoided,
      line_items: row.lineItems as NormalizedSale["line_items"],
    }));
  }

  const rows = await runtime.db
    .select()
    .from(sqlite.normalizedSales)
    .where(
      and(
        eq(sqlite.normalizedSales.merchantId, context.merchantId),
        eq(sqlite.normalizedSales.posProvider, posProvider),
        gte(sqlite.normalizedSales.createdAt, since)
      )
    );

  return rows.map((row) => ({
    id: row.id,
    gross_cents: row.grossCents,
    discount_cents: row.discountCents,
    net_cents: row.netCents,
    is_refunded: row.isRefunded,
    is_voided: row.isVoided,
    line_items: row.lineItems as NormalizedSale["line_items"],
  }));
}

export async function updateBarrelConsumption(
  merchantId: string,
  totalsByBarrelId: Record<
    string,
    {
      ml_consumed: number;
      revenue_bruto_cents: number;
      revenue_descuentos_cents: number;
      revenue_neto_cents: number;
    }
  >
) {
  const runtime = getDatabase();
  const ids = Object.keys(totalsByBarrelId);
  if (ids.length === 0) return;

  if (runtime.dialect === "postgres") {
    await Promise.all(
      ids.map((id) => {
        const totals = totalsByBarrelId[id];
        return runtime.db
          .update(pg.barrels)
          .set({
            mlConsumed: totals.ml_consumed,
            yieldPct: sql`case when ${pg.barrels.volumeMl} > 0 then (${totals.ml_consumed} * 10000) / ${pg.barrels.volumeMl} else 0 end`,
            revenueBrutoCents: totals.revenue_bruto_cents,
            revenueDescuentosCents: totals.revenue_descuentos_cents,
            revenueNetoCents: totals.revenue_neto_cents,
            updatedAt: new Date(),
          })
          .where(and(eq(pg.barrels.merchantId, merchantId), eq(pg.barrels.id, id)));
      })
    );
    return;
  }

  await Promise.all(
    ids.map((id) => {
      const totals = totalsByBarrelId[id];
      return runtime.db
        .update(sqlite.barrels)
        .set({
          mlConsumed: totals.ml_consumed,
          yieldPct: sql`case when ${sqlite.barrels.volumeMl} > 0 then (${totals.ml_consumed} * 10000) / ${sqlite.barrels.volumeMl} else 0 end`,
          revenueBrutoCents: totals.revenue_bruto_cents,
          revenueDescuentosCents: totals.revenue_descuentos_cents,
          revenueNetoCents: totals.revenue_neto_cents,
          updatedAt: new Date(),
        })
        .where(and(eq(sqlite.barrels.merchantId, merchantId), eq(sqlite.barrels.id, id)));
    })
  );
}

export async function touchPollingLog(
  context: PersistenceContext,
  dataType: string,
  raw?: unknown
) {
  const runtime = getDatabase();
  const now = new Date();
  const posProvider = providerFor(context);
  const id = `${context.merchantId}:${posProvider}:${dataType}`;

  if (runtime.dialect === "postgres") {
    await runtime.db
      .insert(pg.pollingLogs)
      .values({
        id,
        merchantId: context.merchantId,
        posProvider,
        dataType,
        lastPolledAt: now,
        lastSyncedAt: now,
        raw: raw ?? null,
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
      posProvider,
      dataType,
      lastPolledAt: now,
      lastSyncedAt: now,
      raw: raw ?? null,
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

export async function getActiveBarrels(context: PersistenceContext): Promise<ActiveBarrelRecord[]> {
  const runtime = getDatabase();

  if (runtime.dialect === "postgres") {
    const rows = await runtime.db
      .select()
      .from(pg.barrels)
      .where(and(eq(pg.barrels.merchantId, context.merchantId), eq(pg.barrels.status, "active")));
    return rows.map((row) => ({
      id: row.id,
      merchantId: row.merchantId,
      posProvider: row.posProvider,
      locationId: row.locationId,
      lineId: row.lineId,
      kegId: row.kegId,
      brand: row.brand,
      groupName: row.groupName,
      externalProductIds: row.externalProductIds,
      volumeMl: row.volumeMl,
      pricePaidCents: row.pricePaidCents,
      mlConsumed: row.mlConsumed,
      mermaMl: row.mermaMl,
      status: row.status,
      openedAt: row.openedAt,
    }));
  }

  const rows = await runtime.db
    .select()
    .from(sqlite.barrels)
    .where(and(eq(sqlite.barrels.merchantId, context.merchantId), eq(sqlite.barrels.status, "active")));
  return rows.map((row) => ({
    id: row.id,
    merchantId: row.merchantId,
    posProvider: row.posProvider,
    locationId: row.locationId,
    lineId: row.lineId,
    kegId: row.kegId,
    brand: row.brand,
    groupName: row.groupName,
    externalProductIds: row.externalProductIds ?? null,
    volumeMl: row.volumeMl,
    pricePaidCents: row.pricePaidCents,
    mlConsumed: row.mlConsumed,
    mermaMl: row.mermaMl,
    status: row.status,
    openedAt: row.openedAt,
  }));
}
