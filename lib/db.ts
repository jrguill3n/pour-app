import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

// Database Types (matching our schema)
export interface DbUser {
  id: string;
  email: string;
  created_at: Date;
}

export interface DbAccount {
  id: string;
  user_id: string;
  poster_account_id: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbProduct {
  id: string;
  account_id: string;
  poster_product_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbEmployee {
  id: string;
  account_id: string;
  poster_employee_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbSpot {
  id: string;
  account_id: string;
  poster_spot_id: string;
  name: string;
  created_at: Date;
  updated_at: Date;
}

export interface DbProductConfig {
  id: string;
  account_id: string;
  product_id: string;
  cup_ml: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbBarrel {
  id: string;
  account_id: string;
  spot_id: string | null;
  line_id: number;
  group_name: string | null;
  product_ids: string[] | null;
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
  account_id: string;
  data_type: string;
  last_polled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export { sql };
