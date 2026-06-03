import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { INITIAL_BARRELS, PRODUCTS } from "@/lib/pour-data";
import { EMPLOYEES } from "@/lib/pour-data";
import * as schema from "@/lib/db/schema/sqlite";
import type { NormalizedEmployee, NormalizedProduct } from "@/lib/pos/types";
import { saveEmployees, saveProducts } from "@/lib/db/repositories/pos";
import { saveAccount } from "@/lib/db/repositories/accounts";
import { saveUser } from "@/lib/db/repositories/users";
import { saveDraftCategoryEligibility } from "@/lib/db/repositories/operations";

const sqliteUrl = process.env.SQLITE_DATABASE_URL ?? "file:./data/dev.db";
const sqlitePath = sqliteUrl.startsWith("file:") ? sqliteUrl.slice("file:".length) : sqliteUrl;

mkdirSync(dirname(sqlitePath), { recursive: true });

const seedDb = drizzle(new Database(sqlitePath), { schema });
const merchantId = "mock-merchant";
const now = new Date();

const normalizedProducts: NormalizedProduct[] = PRODUCTS.map((product) => ({
  id: product.id.toString(),
  external_product_id: product.external_product_id,
  pos_provider: "mock",
  merchant_id: merchantId,
  name: product.name,
  description: product.description ?? null,
    category_id: product.category_id ?? null,
    category_name: product.category_name ?? null,
    external_category_id: product.external_category_id ?? product.category_id ?? null,
    price_cents: product.price_cents ?? null,
  cup_ml: product.cupMl,
  raw: product,
}));

const normalizedEmployees: NormalizedEmployee[] = EMPLOYEES.map((employee, index) => ({
  id: `mock-employee-${index + 1}`,
  external_employee_id: String(index + 1),
  pos_provider: "mock",
  merchant_id: merchantId,
  name: employee,
  raw: { name: employee },
}));

async function main() {
  const demoUser = await saveUser({
    email: "demo@pour.local",
    name: "Pour Demo",
    raw: { mode: "demo" },
  });

  await saveAccount({
    userId: demoUser.id,
    merchantId,
    posProvider: "mock",
    posAccountId: "demo",
    accessToken: "demo-token",
    raw: { mode: "demo", provider_label: "Demo POS" },
  });

  await saveProducts({ merchantId, posProvider: "mock" }, normalizedProducts);
  await saveEmployees({ merchantId, posProvider: "mock" }, normalizedEmployees);
  await saveDraftCategoryEligibility(
    { merchantId, posProvider: "mock" },
    [{ externalCategoryId: "mock-draft", name: "Demo Draft", isDraftEligible: true }]
  );

  await seedDb
    .insert(schema.barrels)
    .values(
      INITIAL_BARRELS.map((barrel) => ({
        id: barrel.id.toString(),
        merchantId,
        posProvider: barrel.pos_provider,
        locationId: barrel.location_id,
        lineId: barrel.lineId,
        kegId: barrel.kegId,
        brand: barrel.brand,
        groupName: barrel.group,
        beerStyle: barrel.beerStyle,
        abv: barrel.abv ? Math.round(barrel.abv * 100) : null,
        externalProductIds: barrel.external_product_ids,
        volumeMl: barrel.volumeL * 1000,
        pricePaidCents: Math.round(barrel.pricePaid * 100),
        mlConsumed: barrel.mlConsumed,
        mermaMl: barrel.mermaMl,
        status: barrel.status,
        openedAt: new Date(barrel.openedAt),
        openedBy: barrel.openedBy,
        closedAt: barrel.closedAt ? new Date(barrel.closedAt) : null,
        closedBy: barrel.closedBy,
        raw: barrel,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing();

  console.log(`Seeded local SQLite database at ${sqlitePath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
