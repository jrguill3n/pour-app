import type {
  NormalizedEmployee,
  NormalizedLocation,
  NormalizedProduct,
  NormalizedSale,
  POSConnector,
  POSConnectorContext,
  POSDateRange,
} from "@/lib/pos/types";

const POSTER_API_URL = "https://joinposter.com/api";

export interface PosterTokenResponse {
  access_token: string;
  account_number: string;
  refresh_token?: string;
  expires_in?: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface PosterProduct {
  product_id: string;
  product_name: string;
  menu_category_id?: string;
  cost?: string;
  cost_netto?: string;
  price?: Record<string, string>;
}

interface PosterEmployee {
  employee_id: string;
  name: string;
  role_id?: string;
}

interface PosterSpot {
  spot_id: string;
  spot_name: string;
  spot_adress?: string;
}

interface PosterTransaction {
  transaction_id: string;
  spot_id?: string;
  employee_id?: string;
  date_created: string;
  payed_sum?: string;
  sum?: string;
  discount?: string;
  products?: {
    product_id: string;
    product_name: string;
    num: string;
    product_price: string;
  }[];
}

function requireAccessToken(context: POSConnectorContext): string {
  if (!context.accessToken) {
    throw new Error("Poster access token is required.");
  }

  return context.accessToken;
}

function toCents(value?: string | number | null): number {
  const numeric = typeof value === "number" ? value : Number.parseFloat(value || "0");
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

async function posterApiCall<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = new URL(`${POSTER_API_URL}/${endpoint}`);
  url.searchParams.set("token", accessToken);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Poster API error: ${response.status} - ${text}`);
  }

  const data = await response.json();
  return data.response || data;
}

export async function exchangeCodeForToken(
  code: string,
  applicationId: string,
  applicationSecret: string,
  redirectUri: string
): Promise<PosterTokenResponse> {
  const response = await fetch(`${POSTER_API_URL}/auth/access_token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      application_id: applicationId,
      application_secret: applicationSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Poster OAuth error: ${response.status} - ${text}`);
  }

  return response.json();
}

export function getOAuthUrl(
  applicationId: string,
  redirectUri: string,
  state?: string
): string {
  const params = new URLSearchParams({
    application_id: applicationId,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  if (state) {
    params.set("state", state);
  }
  return `https://joinposter.com/api/auth?${params.toString()}`;
}

export function normalizePosterProduct(
  product: PosterProduct,
  merchant_id?: string
): NormalizedProduct {
  const firstPrice = product.price ? Object.values(product.price)[0] : undefined;

  return {
    id: `poster:${product.product_id}`,
    external_product_id: product.product_id,
    pos_provider: "poster",
    merchant_id,
    name: product.product_name,
    category_id: product.menu_category_id || null,
    price_cents: toCents(firstPrice),
    raw: product,
  };
}

export function normalizePosterEmployee(
  employee: PosterEmployee,
  merchant_id?: string
): NormalizedEmployee {
  return {
    id: `poster:${employee.employee_id}`,
    external_employee_id: employee.employee_id,
    pos_provider: "poster",
    merchant_id,
    name: employee.name,
    role_id: employee.role_id || null,
    raw: employee,
  };
}

export function normalizePosterLocation(
  spot: PosterSpot,
  merchant_id?: string
): NormalizedLocation {
  return {
    id: `poster:${spot.spot_id}`,
    external_location_id: spot.spot_id,
    pos_provider: "poster",
    merchant_id,
    name: spot.spot_name,
    address: spot.spot_adress || null,
    raw: spot,
  };
}

export function normalizePosterSale(
  transaction: PosterTransaction,
  merchant_id?: string
): NormalizedSale {
  const discount_cents = toCents(transaction.discount);
  const gross_cents = toCents(transaction.sum || transaction.payed_sum) + discount_cents;
  const line_items = (transaction.products || []).map((product) => {
    const quantity = Number.parseFloat(product.num || "0") || 0;
    const unit_price_cents = toCents(product.product_price);

    return {
      external_product_id: product.product_id,
      name: product.product_name,
      quantity,
      unit_price_cents,
      gross_cents: Math.round(quantity * unit_price_cents),
    };
  });

  return {
    id: `poster:${transaction.transaction_id}`,
    external_transaction_id: transaction.transaction_id,
    pos_provider: "poster",
    merchant_id,
    location_id: transaction.spot_id || null,
    employee_id: transaction.employee_id || null,
    created_at: transaction.date_created,
    gross_cents,
    discount_cents,
    net_cents: Math.max(0, gross_cents - discount_cents),
    line_items,
    raw: transaction,
  };
}

export const posterConnector: POSConnector = {
  provider: "poster",
  async getLocations(context) {
    const accessToken = requireAccessToken(context);
    const spots = await posterApiCall<PosterSpot[]>("settings.getAllSpots", accessToken);
    return spots.map((spot) => normalizePosterLocation(spot, context.merchant_id));
  },
  async getProducts(context) {
    const accessToken = requireAccessToken(context);
    const products = await posterApiCall<PosterProduct[]>("menu.getProducts", accessToken);
    return products.map((product) => normalizePosterProduct(product, context.merchant_id));
  },
  async getEmployees(context) {
    const accessToken = requireAccessToken(context);
    const employees = await posterApiCall<PosterEmployee[]>("access.getEmployees", accessToken);
    return employees.map((employee) => normalizePosterEmployee(employee, context.merchant_id));
  },
  async getTransactions(context, range: POSDateRange) {
    const accessToken = requireAccessToken(context);
    const transactions = await posterApiCall<PosterTransaction[]>(
      "transactions.getTransactions",
      accessToken,
      {
        date_from: range.from,
        date_to: range.to,
      }
    );
    return transactions.map((transaction) => normalizePosterSale(transaction, context.merchant_id));
  },
};
