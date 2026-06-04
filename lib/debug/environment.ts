import type { DatabaseDialect } from "@/lib/db/client";

export interface EnvironmentDebugInput {
  commitSha?: string | null;
  databaseDialect: DatabaseDialect;
  connectedMerchantCount: number;
  demoMode: boolean;
  databaseReachable: boolean;
  databaseError: string | null;
  enabled: boolean;
  nodeEnv?: string;
  envPresence: {
    databaseUrl: boolean;
    posterApplicationId: boolean;
    posterApplicationSecret: boolean;
    posterRedirectUri: boolean;
    appUrl: boolean;
  };
}

export interface EnvironmentDebugSummary extends EnvironmentDebugInput {
  shortCommitSha: string;
  productionSQLiteWarning: boolean;
}

export function buildEnvironmentDebugSummary(input: EnvironmentDebugInput): EnvironmentDebugSummary {
  const commitSha = input.commitSha?.trim() || "unknown";

  return {
    ...input,
    commitSha,
    shortCommitSha: commitSha === "unknown" ? commitSha : commitSha.slice(0, 7),
    productionSQLiteWarning: (input.nodeEnv ?? process.env.NODE_ENV) === "production" && input.databaseDialect === "sqlite",
  };
}

export function isEnvironmentDebugEnabled() {
  return process.env.NODE_ENV !== "production" ||
    process.env.ENABLE_ADMIN_DEBUG_BADGE === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_ADMIN_DEBUG_BADGE === "true";
}
