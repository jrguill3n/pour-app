import type { POSProvider } from "../../pos/types";

export interface OperationalContextInput {
  merchantId: string;
  posProvider: string;
}

export const DEMO_CONTEXT = {
  merchantId: "mock-merchant",
  posProvider: "mock",
} satisfies { merchantId: string; posProvider: POSProvider };

export function hasRealConnectedAccount(accounts: Array<{ posProvider: string }>): boolean {
  return accounts.some((account) => account.posProvider !== "mock");
}

export function chooseContext(
  accounts: OperationalContextInput[],
  preferredProvider?: POSProvider
) {
  const preferred = preferredProvider
    ? accounts.find((account) => account.posProvider === preferredProvider)
    : accounts.find((account) => account.posProvider !== "mock") ?? accounts[0];

  if (!preferred) return DEMO_CONTEXT;

  return {
    merchantId: preferred.merchantId,
    posProvider: preferred.posProvider as POSProvider,
  };
}
