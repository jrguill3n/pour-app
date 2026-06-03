export type POSProvider = "poster" | "square" | "toast" | "clover" | "mock" | (string & {});

export interface POSConnectorContext {
  accessToken?: string;
  merchant_id?: string;
  pos_account_id?: string;
}

export interface POSDateRange {
  from: string;
  to: string;
}

export interface NormalizedLocation {
  id: string;
  external_location_id: string;
  pos_provider: POSProvider;
  merchant_id?: string;
  name: string;
  address?: string | null;
  raw?: unknown;
}

export interface NormalizedProduct {
  id: string;
  external_product_id: string;
  pos_provider: POSProvider;
  merchant_id?: string;
  name: string;
  description?: string | null;
  category_id?: string | null;
  category_name?: string | null;
  external_category_id?: string | null;
  parent_external_product_id?: string | null;
  parent_product_name?: string | null;
  variant_external_id?: string | null;
  variant_name?: string | null;
  price_cents?: number | null;
  cup_ml?: number | null;
  raw?: unknown;
}

export interface NormalizedEmployee {
  id: string;
  external_employee_id: string;
  pos_provider: POSProvider;
  merchant_id?: string;
  name: string;
  role_id?: string | null;
  raw?: unknown;
}

export interface NormalizedSaleLineItem {
  external_product_id: string;
  name: string;
  quantity: number;
  unit_price_cents: number;
  gross_cents: number;
  discount_cents?: number;
  net_cents?: number;
}

export interface NormalizedSale {
  id: string;
  external_transaction_id: string;
  pos_provider: POSProvider;
  merchant_id?: string;
  location_id?: string | null;
  employee_id?: string | null;
  created_at: string;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  is_refunded?: boolean;
  is_voided?: boolean;
  status?: string | null;
  line_items: NormalizedSaleLineItem[];
  raw?: unknown;
}

export interface POSConnector {
  provider: POSProvider;
  getLocations(context: POSConnectorContext): Promise<NormalizedLocation[]>;
  getProducts(context: POSConnectorContext): Promise<NormalizedProduct[]>;
  getEmployees(context: POSConnectorContext): Promise<NormalizedEmployee[]>;
  getTransactions(
    context: POSConnectorContext,
    range: POSDateRange
  ): Promise<NormalizedSale[]>;
}
