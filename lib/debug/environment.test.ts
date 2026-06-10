import { describe, expect, it } from "vitest";
import { buildEnvironmentDebugSummary } from "./environment";

describe("environment debug summary", () => {
  it("shortens commit sha without exposing secret values", () => {
    const summary = buildEnvironmentDebugSummary({
      commitSha: "01ee36d2a42ca78dd26df5496ad906fe53c31ccd",
      databaseDialect: "postgres",
      connectedMerchantCount: 1,
      demoMode: false,
      databaseReachable: true,
      databaseError: null,
      enabled: true,
      envPresence: {
        databaseUrl: true,
        posterApplicationId: true,
        posterApplicationSecret: true,
        posterRedirectUri: true,
        appUrl: true,
      },
    });

    expect(summary.shortCommitSha).toBe("01ee36d");
    expect(summary.envPresence.posterApplicationSecret).toBe(true);
    expect(JSON.stringify(summary)).not.toContain("4e977456");
  });

  it("flags production sqlite as unsafe", () => {
    const summary = buildEnvironmentDebugSummary({
      commitSha: null,
      databaseDialect: "sqlite",
      connectedMerchantCount: 0,
      demoMode: true,
      databaseReachable: false,
      databaseError: "database unavailable",
      enabled: true,
      nodeEnv: "production",
      envPresence: {
        databaseUrl: false,
        posterApplicationId: false,
        posterApplicationSecret: false,
        posterRedirectUri: false,
        appUrl: false,
      },
    });

    expect(summary.shortCommitSha).toBe("unknown");
    expect(summary.productionSQLiteWarning).toBe(true);
  });
});
