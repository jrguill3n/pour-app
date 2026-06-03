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

// Poster is a read-only POS source of truth for Pour. Connector data methods
// may fetch catalog and transaction data, but must not mutate Poster records.

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

export interface PosterTokenExchangeDebug {
  tokenUrl: string;
  requestContentType: string;
  payloadKeys: string[];
  hasAccount: boolean;
  account: string | null;
  status: number;
  bodyKeys: string[];
  apiErrorMessage: string | null;
  sanitizedBody: unknown;
}

export class PosterOAuthExchangeError extends Error {
  tokenUrl: string;
  requestContentType: string;
  payloadKeys: string[];
  hasAccount: boolean;
  account: string | null;
  status: number;
  bodyKeys: string[];
  apiErrorMessage: string | null;
  sanitizedBody: unknown;

  constructor(debug: PosterTokenExchangeDebug) {
    super(`Poster OAuth error: ${debug.status}${debug.apiErrorMessage ? ` - ${debug.apiErrorMessage}` : ""}`);
    this.name = "PosterOAuthExchangeError";
    this.tokenUrl = debug.tokenUrl;
    this.requestContentType = debug.requestContentType;
    this.payloadKeys = debug.payloadKeys;
    this.hasAccount = debug.hasAccount;
    this.account = debug.account;
    this.status = debug.status;
    this.bodyKeys = debug.bodyKeys;
    this.apiErrorMessage = debug.apiErrorMessage;
    this.sanitizedBody = debug.sanitizedBody;
  }
}

interface PosterProduct {
  product_id: string;
  product_name: string;
  menu_category_id?: string;
  category_name?: string;
  cost?: string;
  cost_netto?: string;
  price?: Record<string, string>;
  modifications?: PosterModification[];
}

interface PosterModification {
  modificator_id: string;
  modificator_name: string;
  spots?: {
    spot_id: string;
    price?: string;
    profit?: string;
    visible?: string;
  }[];
}

interface PosterEmployee {
  user_id: string;
  employee_id?: string;
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
  status?: string;
  is_refund?: string | boolean;
  is_refunded?: string | boolean;
  is_void?: string | boolean;
  is_voided?: string | boolean;
  canceled?: string | boolean;
  refund?: string | boolean;
  products?: {
    product_id: string;
    modification_id?: string | number;
    product_name?: string;
    num: string | number;
    product_price?: string | number;
    product_sum?: string | number;
    payed_sum?: string | number;
    discount?: string | number;
  }[];
}

interface PosterTransactionListResponse {
  count?: number;
  page?: unknown;
  data?: PosterTransaction[];
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

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true" || value === "yes";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseJsonBody(text: string): unknown {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function bodyKeys(body: unknown): string[] {
  return isRecord(body) ? Object.keys(body) : [];
}

function apiErrorMessage(body: unknown): string | null {
  if (!isRecord(body)) return null;

  if (isRecord(body.error) && typeof body.error.message === "string") {
    return body.error.message;
  }

  for (const key of ["error_description", "error_message", "message", "error"]) {
    const value = body[key];
    if (typeof value === "string") {
      return value;
    }
  }

  return null;
}

function responseBodyForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return `[array:${value.length}]`;
  }

  if (!isRecord(value)) {
    return sanitizeForLog(value);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const lowerKey = key.toLowerCase();
      const shouldRedact =
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey === "application_secret";

      return [key, shouldRedact ? "[redacted]" : responseBodyForLog(item)];
    })
  );
}

function sanitizeForLog(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLog(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => {
      const lowerKey = key.toLowerCase();
      const shouldRedact =
        lowerKey.includes("token") ||
        lowerKey.includes("secret") ||
        lowerKey === "application_secret";

      return [key, shouldRedact ? "[redacted]" : sanitizeForLog(item)];
    })
  );
}

function hasTokenResponseShape(body: unknown): body is PosterTokenResponse {
  return (
    isRecord(body) &&
    typeof body.access_token === "string" &&
    typeof body.account_number === "string" &&
    isRecord(body.user) &&
    typeof body.user.email === "string"
  );
}

function posterVariantExternalProductId(parentProductId: string | number, variantId?: string | number | null): string {
  const normalizedVariantId = String(variantId ?? "0");
  return normalizedVariantId && normalizedVariantId !== "0"
    ? `${String(parentProductId)}:${normalizedVariantId}`
    : String(parentProductId);
}

function variantPriceCents(modification: PosterModification): number {
  const visibleSpot = modification.spots?.find((spot) => spot.visible !== "0") ?? modification.spots?.[0];
  return toCents(visibleSpot?.price);
}

async function posterApiCall<T>(
  endpoint: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<T> {
  const method = "GET";
  const url = new URL(`${POSTER_API_URL}/${endpoint}`);
  url.searchParams.set("token", accessToken);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString());
  const text = await response.text();
  const data = parseJsonBody(text);
  const diagnostics = {
    endpoint,
    method,
    responseStatus: response.status,
    sanitizedResponseBody: responseBodyForLog(data ?? text),
  };

  console.info("Poster API response.", diagnostics);

  if (!response.ok || (isRecord(data) && data.error)) {
    console.warn("Poster API request failed.", diagnostics);
    throw new Error(
      `Poster API error: ${response.status} - ${apiErrorMessage(data) ?? "Unknown Poster API error"}`
    );
  }

  return (isRecord(data) && "response" in data ? data.response : data) as T;
}

export async function exchangeCodeForToken(
  code: string,
  account: string,
  applicationId: string,
  applicationSecret: string,
  redirectUri: string
): Promise<PosterTokenResponse> {
  const { tokenResponse } = await exchangeCodeForTokenWithDebug(
    code,
    account,
    applicationId,
    applicationSecret,
    redirectUri
  );

  return tokenResponse;
}

export async function exchangeCodeForTokenWithDebug(
  code: string,
  account: string,
  applicationId: string,
  applicationSecret: string,
  redirectUri: string
): Promise<{ tokenResponse: PosterTokenResponse; debug: PosterTokenExchangeDebug }> {
  const tokenUrl = `https://${account}.joinposter.com/api/v2/auth/access_token`;
  const payload = new FormData();
  payload.set("application_id", applicationId);
  payload.set("application_secret", applicationSecret);
  payload.set("grant_type", "authorization_code");
  payload.set("redirect_uri", redirectUri);
  payload.set("code", code);

  const response = await fetch(tokenUrl, {
    method: "POST",
    body: payload,
  });
  const text = await response.text();
  const body = parseJsonBody(text);
  const debug = {
    tokenUrl,
    requestContentType: "multipart/form-data",
    payloadKeys: [
      "application_id",
      "application_secret",
      "grant_type",
      "redirect_uri",
      "code",
    ],
    hasAccount: Boolean(account),
    account: account || null,
    status: response.status,
    bodyKeys: bodyKeys(body),
    apiErrorMessage: apiErrorMessage(body),
    sanitizedBody: sanitizeForLog(body),
  };

  if (!response.ok || debug.apiErrorMessage || !hasTokenResponseShape(body)) {
    throw new PosterOAuthExchangeError(debug);
  }

  return {
    tokenResponse: body,
    debug,
  };
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
    category_name: product.category_name || null,
    external_category_id: product.menu_category_id || null,
    parent_external_product_id: null,
    parent_product_name: null,
    variant_external_id: null,
    variant_name: null,
    price_cents: toCents(firstPrice),
    raw: product,
  };
}

export function normalizePosterProducts(
  product: PosterProduct,
  merchant_id?: string
): NormalizedProduct[] {
  const parent = normalizePosterProduct(product, merchant_id);
  const modifications = product.modifications ?? [];

  if (modifications.length === 0) {
    return [parent];
  }

  return [
    parent,
    ...modifications.map((modification) => {
      const variantName = modification.modificator_name.trim();
      const externalProductId = posterVariantExternalProductId(
        product.product_id,
        modification.modificator_id
      );

      return {
        ...parent,
        id: `poster:${externalProductId}`,
        external_product_id: externalProductId,
        name: variantName,
        price_cents: variantPriceCents(modification) || parent.price_cents,
        parent_external_product_id: product.product_id,
        parent_product_name: product.product_name,
        variant_external_id: modification.modificator_id,
        variant_name: variantName,
        raw: {
          parent_product: product,
          modification,
        },
      };
    }),
  ];
}

export function normalizePosterEmployee(
  employee: PosterEmployee,
  merchant_id?: string
): NormalizedEmployee {
  const employeeId = employee.employee_id ?? employee.user_id;

  return {
    id: `poster:${employeeId}`,
    external_employee_id: employeeId,
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
  const status = transaction.status ?? null;
  const normalizedStatus = status?.toLowerCase() ?? "";
  const is_refunded =
    isTruthyFlag(transaction.is_refund) ||
    isTruthyFlag(transaction.is_refunded) ||
    isTruthyFlag(transaction.refund) ||
    normalizedStatus.includes("refund");
  const is_voided =
    isTruthyFlag(transaction.is_void) ||
    isTruthyFlag(transaction.is_voided) ||
    isTruthyFlag(transaction.canceled) ||
    normalizedStatus.includes("void") ||
    normalizedStatus.includes("cancel");
  const line_items = (transaction.products || []).map((product) => {
    const quantity = Number.parseFloat(String(product.num || "0")) || 0;
    const grossSource = product.product_sum ?? product.payed_sum;
    const unit_price_cents =
      product.product_price !== undefined
        ? toCents(product.product_price)
        : quantity > 0
        ? Math.round(toCents(grossSource) / quantity)
        : 0;
    const item_discount_cents = toCents(product.discount);
    const item_gross_cents = grossSource !== undefined ? toCents(grossSource) : Math.round(quantity * unit_price_cents);
    const externalProductId = posterVariantExternalProductId(product.product_id, product.modification_id);

    return {
      external_product_id: externalProductId,
      name: product.product_name ?? externalProductId,
      quantity,
      unit_price_cents,
      gross_cents: item_gross_cents,
      discount_cents: item_discount_cents,
      net_cents: Math.max(0, item_gross_cents - item_discount_cents),
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
    is_refunded,
    is_voided,
    status,
    line_items,
    raw: transaction,
  };
}

export const posterConnector: POSConnector = {
  provider: "poster",
  async getLocations(context) {
    const accessToken = requireAccessToken(context);
    const spots = await posterApiCall<PosterSpot[]>("access.getSpots", accessToken);
    return spots.map((spot) => normalizePosterLocation(spot, context.merchant_id));
  },
  async getProducts(context) {
    const accessToken = requireAccessToken(context);
    const products = await posterApiCall<PosterProduct[]>("menu.getProducts", accessToken);
    return products.flatMap((product) => normalizePosterProducts(product, context.merchant_id));
  },
  async getEmployees(context) {
    const accessToken = requireAccessToken(context);
    const employees = await posterApiCall<PosterEmployee[]>("access.getEmployees", accessToken);
    return employees.map((employee) => normalizePosterEmployee(employee, context.merchant_id));
  },
  async getTransactions(context, range: POSDateRange) {
    const accessToken = requireAccessToken(context);
    const transactions = await posterApiCall<PosterTransaction[] | PosterTransactionListResponse>(
      "transactions.getTransactions",
      accessToken,
      {
        date_from: range.from,
        date_to: range.to,
      }
    );
    const rows = Array.isArray(transactions) ? transactions : transactions.data ?? [];
    return rows.map((transaction) => normalizePosterSale(transaction, context.merchant_id));
  },
};
