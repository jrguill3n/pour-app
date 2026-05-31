import { eq, and, sql } from "drizzle-orm";
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

function providerFor(context: PersistenceContext, provider?: POSProvider): string {
  return provider ?? context.posProvider ?? "poster";
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
        lineItems: sql`excluded.line_items`,
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
