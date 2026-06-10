import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  raw: jsonb("raw"),
  ...timestamps,
});

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    posAccountId: text("pos_account_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    autoSyncEnabled: boolean("auto_sync_enabled").notNull().default(true),
    syncIntervalMinutes: integer("sync_interval_minutes").notNull().default(5),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    nextSyncAt: timestamp("next_sync_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("accounts_pos_provider_pos_account_id_key").on(table.posProvider, table.posAccountId),
    index("accounts_user_id_idx").on(table.userId),
  ]
);

export const locations = pgTable(
  "locations",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    externalLocationId: text("external_location_id").notNull(),
    name: text("name").notNull(),
    address: text("address"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("locations_merchant_pos_external_location_key").on(
      table.merchantId,
      table.posProvider,
      table.externalLocationId
    ),
  ]
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    externalProductId: text("external_product_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    categoryId: text("category_id"),
    categoryName: text("category_name"),
    externalCategoryId: text("external_category_id"),
    parentExternalProductId: text("parent_external_product_id"),
    parentProductName: text("parent_product_name"),
    variantExternalId: text("variant_external_id"),
    variantName: text("variant_name"),
    priceCents: integer("price_cents"),
    cupMl: integer("cup_ml"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("products_merchant_pos_external_product_key").on(
      table.merchantId,
      table.posProvider,
      table.externalProductId
    ),
  ]
);

export const posProductCategories = pgTable(
  "pos_product_categories",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    externalCategoryId: text("external_category_id").notNull(),
    name: text("name").notNull(),
    isDraftEligible: boolean("is_draft_eligible").notNull().default(false),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("pos_categories_merchant_pos_external_key").on(
      table.merchantId,
      table.posProvider,
      table.externalCategoryId
    ),
  ]
);

export const lines = pgTable(
  "lines",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    lineNumber: integer("line_number").notNull(),
    note: text("note"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("lines_merchant_pos_line_number_key").on(
      table.merchantId,
      table.posProvider,
      table.lineNumber
    ),
  ]
);

export const employees = pgTable(
  "employees",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    externalEmployeeId: text("external_employee_id").notNull(),
    name: text("name").notNull(),
    roleId: text("role_id"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("employees_merchant_pos_external_employee_key").on(
      table.merchantId,
      table.posProvider,
      table.externalEmployeeId
    ),
  ]
);

export const barrels = pgTable(
  "barrels",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    locationId: text("location_id"),
    lineId: integer("line_id").notNull(),
    kegId: text("keg_id"),
    brand: text("brand"),
    groupName: text("group_name"),
    beerStyle: text("beer_style"),
    abv: integer("abv_basis_points"),
    externalProductIds: text("external_product_ids").array(),
    volumeMl: integer("volume_ml").notNull(),
    pricePaidCents: integer("price_paid_cents"),
    mlConsumed: integer("ml_consumed").notNull().default(0),
    mermaMl: integer("merma_ml").notNull().default(0),
    yieldPct: integer("yield_pct_basis_points"),
    revenueBrutoCents: integer("revenue_bruto_cents").notNull().default(0),
    revenueDescuentosCents: integer("revenue_descuentos_cents").notNull().default(0),
    revenueNetoCents: integer("revenue_neto_cents").notNull().default(0),
    status: text("status").notNull().default("active"),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    openedBy: text("opened_by"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    index("barrels_merchant_status_idx").on(table.merchantId, table.status),
    index("barrels_location_idx").on(table.locationId),
  ]
);

export const normalizedSales = pgTable(
  "normalized_sales",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    externalTransactionId: text("external_transaction_id").notNull(),
    locationId: text("location_id"),
    employeeId: text("employee_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    grossCents: integer("gross_cents").notNull(),
    discountCents: integer("discount_cents").notNull(),
    netCents: integer("net_cents").notNull(),
    isRefunded: boolean("is_refunded").notNull().default(false),
    isVoided: boolean("is_voided").notNull().default(false),
    status: text("status"),
    lineItems: jsonb("line_items").$type<unknown[]>().notNull(),
    raw: jsonb("raw"),
    insertedAt: timestamp("inserted_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sales_merchant_pos_external_transaction_key").on(
      table.merchantId,
      table.posProvider,
      table.externalTransactionId
    ),
    index("sales_created_at_idx").on(table.createdAt),
  ]
);

export const pollingLogs = pgTable(
  "polling_logs",
  {
    id: text("id").primaryKey(),
    merchantId: text("merchant_id").notNull(),
    posProvider: text("pos_provider").notNull(),
    dataType: text("data_type").notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    raw: jsonb("raw"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("polling_logs_merchant_pos_data_type_key").on(
      table.merchantId,
      table.posProvider,
      table.dataType
    ),
  ]
);
