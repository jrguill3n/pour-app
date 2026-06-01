import { getAccountByProvider, getFirstAccountByProvider } from "@/lib/db/repositories/accounts";
import { saveEmployees, saveLocations, saveProducts } from "@/lib/db/repositories/pos";
import { posterConnector } from "@/lib/pos/connectors/poster";

export interface PosterSyncInput {
  posAccountId?: string;
}

export interface PosterSyncResult {
  merchantId: string;
  posAccountId: string;
  products: number;
  locations: number;
  employees: number;
}

export async function syncPosterCatalog(input: PosterSyncInput = {}): Promise<PosterSyncResult> {
  const account = input.posAccountId
    ? await getAccountByProvider("poster", input.posAccountId)
    : await getFirstAccountByProvider("poster");

  if (!account) {
    throw new Error("No connected Poster account found.");
  }

  if (!account.accessToken) {
    throw new Error(`Poster account ${account.posAccountId} is missing an access token.`);
  }

  const context = {
    accessToken: account.accessToken,
    merchant_id: account.merchantId,
    pos_account_id: account.posAccountId,
  };

  const [products, locations, employees] = await Promise.all([
    posterConnector.getProducts(context),
    posterConnector.getLocations(context),
    posterConnector.getEmployees(context),
  ]);

  await Promise.all([
    saveProducts({ merchantId: account.merchantId, posProvider: "poster" }, products),
    saveLocations({ merchantId: account.merchantId, posProvider: "poster" }, locations),
    saveEmployees({ merchantId: account.merchantId, posProvider: "poster" }, employees),
  ]);

  return {
    merchantId: account.merchantId,
    posAccountId: account.posAccountId,
    products: products.length,
    locations: locations.length,
    employees: employees.length,
  };
}
