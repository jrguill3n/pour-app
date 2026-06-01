import type { POSConnector } from "@/lib/pos/types";

async function notConfigured(): Promise<never> {
  throw new Error("Square connector is not configured yet.");
}

export const squareConnector: POSConnector = {
  provider: "square",
  getLocations: notConfigured,
  getProducts: notConfigured,
  getEmployees: notConfigured,
  getTransactions: notConfigured,
};
