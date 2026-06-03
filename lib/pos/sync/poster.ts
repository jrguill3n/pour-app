import { getAccountByProvider, getFirstAccountByProvider } from "@/lib/db/repositories/accounts";
import { calculateBarrelConsumption, calculateBarrelConsumptionDiagnostics } from "@/lib/core/consumption";
import {
  getActiveBarrels,
  getCupMlByExternalProductId,
  getSalesForConsumption,
  saveEmployees,
  saveLocations,
  saveProducts,
  saveSales,
  touchPollingLog,
  updateBarrelConsumption,
} from "@/lib/db/repositories/pos";
import { posterConnector } from "@/lib/pos/connectors/poster";

export interface PosterSyncInput {
  posAccountId?: string;
  from?: string;
  to?: string;
}

export interface PosterSyncResult {
  merchantId: string;
  posAccountId: string;
  products: number;
  locations: number;
  employees: number;
}

export interface PosterTransactionSyncResult {
  merchantId: string;
  posAccountId: string;
  transactions: number;
  activeBarrels: number;
}

export interface PosterManualSyncResult extends PosterSyncResult {
  transactions: number;
  activeBarrels: number;
}

async function getPosterAccount(input: PosterSyncInput = {}) {
  const account = input.posAccountId
    ? await getAccountByProvider("poster", input.posAccountId)
    : await getFirstAccountByProvider("poster");

  if (!account) {
    throw new Error("No connected Poster account found.");
  }

  if (!account.accessToken) {
    throw new Error(`Poster account ${account.posAccountId} is missing an access token.`);
  }

  return { ...account, accessToken: account.accessToken };
}

export async function syncPosterCatalog(input: PosterSyncInput = {}): Promise<PosterSyncResult> {
  const account = await getPosterAccount(input);

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
    touchPollingLog(
      { merchantId: account.merchantId, posProvider: "poster" },
      "catalog",
      { products: products.length, locations: locations.length, employees: employees.length }
    ),
  ]);

  return {
    merchantId: account.merchantId,
    posAccountId: account.posAccountId,
    products: products.length,
    locations: locations.length,
    employees: employees.length,
  };
}

export async function syncPosterTransactions(input: PosterSyncInput = {}): Promise<PosterTransactionSyncResult> {
  const account = await getPosterAccount(input);
  const to = input.to ?? new Date().toISOString().slice(0, 10);
  const from = input.from ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString().slice(0, 10);
  const persistenceContext = { merchantId: account.merchantId, posProvider: "poster" as const };
  const connectorContext = {
    accessToken: account.accessToken,
    merchant_id: account.merchantId,
    pos_account_id: account.posAccountId,
  };

  const sales = await posterConnector.getTransactions(connectorContext, { from, to });
  await saveSales(persistenceContext, sales);

  const activeBarrels = await getActiveBarrels(persistenceContext);
  if (activeBarrels.length > 0) {
    const earliestOpenedAt = activeBarrels.reduce(
      (earliest, barrel) => (barrel.openedAt < earliest ? barrel.openedAt : earliest),
      activeBarrels[0].openedAt
    );
    const [cupMlByExternalProductId, storedSales] = await Promise.all([
      getCupMlByExternalProductId(persistenceContext),
      getSalesForConsumption(persistenceContext, earliestOpenedAt),
    ]);
    const totalsByBarrelId = calculateBarrelConsumption(
      activeBarrels.map((barrel) => ({
        id: barrel.id,
        externalProductIds: barrel.externalProductIds,
        opened_at: barrel.openedAt,
      })),
      storedSales,
      cupMlByExternalProductId
    );
    console.info("Barrel consumption diagnostics.", {
      merchantId: account.merchantId,
      diagnostics: calculateBarrelConsumptionDiagnostics(
        activeBarrels.map((barrel) => ({
          id: barrel.id,
          externalProductIds: barrel.externalProductIds,
          opened_at: barrel.openedAt,
        })),
        storedSales
      ).map((diagnostic) => {
        const barrel = activeBarrels.find((item) => item.id === diagnostic.barrel_id);
        return {
          ...diagnostic,
          volume_ml: barrel?.volumeMl ?? null,
        };
      }),
    });
    await updateBarrelConsumption(account.merchantId, totalsByBarrelId);
  }

  await touchPollingLog(persistenceContext, "transactions", {
    from,
    to,
    transactions: sales.length,
    activeBarrels: activeBarrels.length,
  });

  return {
    merchantId: account.merchantId,
    posAccountId: account.posAccountId,
    transactions: sales.length,
    activeBarrels: activeBarrels.length,
  };
}

export async function syncPosterManual(input: PosterSyncInput = {}): Promise<PosterManualSyncResult> {
  const [catalog, transactions] = await Promise.all([
    syncPosterCatalog(input),
    syncPosterTransactions(input),
  ]);

  return {
    ...catalog,
    transactions: transactions.transactions,
    activeBarrels: transactions.activeBarrels,
  };
}
