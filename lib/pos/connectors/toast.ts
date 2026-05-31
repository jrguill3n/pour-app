import type { POSConnector } from "@/lib/pos/types";

async function notConfigured(): Promise<never> {
  throw new Error("Toast connector is not configured yet.");
}

export const toastConnector: POSConnector = {
  provider: "toast",
  getLocations: notConfigured,
  getProducts: notConfigured,
  getEmployees: notConfigured,
  getTransactions: notConfigured,
};
