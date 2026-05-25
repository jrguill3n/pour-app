// Poster POS API Service
// Documentation: https://dev.joinposter.com/en/docs/v3/start/

const POSTER_API_URL = "https://joinposter.com/api";

interface PosterTokenResponse {
  access_token: string;
  account_number: string;
  user: {
    id: number;
    name: string;
    email: string;
  };
}

interface PosterProduct {
  product_id: string;
  product_name: string;
  menu_category_id: string;
  cost: string;
  cost_netto: string;
  price: { [key: string]: string };
}

interface PosterEmployee {
  employee_id: string;
  name: string;
  role_id: string;
}

interface PosterSpot {
  spot_id: string;
  spot_name: string;
  spot_adress: string;
}

interface PosterTransaction {
  transaction_id: string;
  date_created: string;
  payed_sum: string;
  discount: string;
  products: {
    product_id: string;
    product_name: string;
    num: string;
    product_price: string;
  }[];
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

export async function getProducts(accessToken: string): Promise<PosterProduct[]> {
  return posterApiCall<PosterProduct[]>("menu.getProducts", accessToken);
}

export async function getEmployees(accessToken: string): Promise<PosterEmployee[]> {
  return posterApiCall<PosterEmployee[]>("access.getEmployees", accessToken);
}

export async function getSpots(accessToken: string): Promise<PosterSpot[]> {
  return posterApiCall<PosterSpot[]>("settings.getAllSpots", accessToken);
}

export async function getTransactions(
  accessToken: string,
  dateFrom: string,
  dateTo: string
): Promise<PosterTransaction[]> {
  return posterApiCall<PosterTransaction[]>("transactions.getTransactions", accessToken, {
    date_from: dateFrom,
    date_to: dateTo,
  });
}

// Generate OAuth authorization URL
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
