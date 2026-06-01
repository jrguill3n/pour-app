import { neon } from "@neondatabase/serverless";

let cachedSql: ReturnType<typeof neon> | null = null;

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before querying the database.");
  }

  cachedSql ||= neon(databaseUrl);
  return cachedSql;
}

const sql = ((strings, ...values) => getSql()(strings, ...values)) as ReturnType<typeof neon>;

// Database Types (matching our schema)
export interface DbUser {
  id: string;
  email: string;
  created_at: Date;
}

export interface DbAccount {
  id: string;
  user_id: string;
  pos_provider: string;
  pos_account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbProduct {
  id: string;
  merchant_id: string;
  pos_provider: string;
  external_product_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbEmployee {
  id: string;
  merchant_id: string;
  pos_provider: string;
  external_employee_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbLocation {
  id: string;
  merchant_id: string;
  pos_provider: string;
  external_location_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbProductConfig {
  id: string;
  merchant_id: string;
  external_product_id: string;
  cup_ml: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbBarrel {
  id: string;
  merchant_id: string;
  pos_provider: string;
  location_id: string | null;
  line_id: number;
  group_name: string | null;
  external_product_ids: string[] | null;
  volume_ml: number;
  price_paid_cents: number | null;
  ml_consumed: number;
  merma_ml: number;
  yield_pct: number | null;
  status: string;
  opened_at: Date;
  opened_by: string | null;
  closed_at: Date | null;
  closed_by: string | null;
  revenue_bruto_cents: number;
  revenue_descuentos_cents: number;
  revenue_neto_cents: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbPollingLog {
  id: string;
  merchant_id: string;
  pos_provider: string;
  data_type: string;
  last_polled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export { sql };
