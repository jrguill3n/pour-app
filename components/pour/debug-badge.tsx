"use client";

import { useEffect, useState } from "react";

interface EnvironmentDebugResponse {
  ok: boolean;
  enabled: boolean;
  debug?: {
    shortCommitSha: string;
    databaseDialect: string;
    connectedMerchantCount: number;
    demoMode: boolean;
    databaseReachable: boolean;
    productionSQLiteWarning: boolean;
  };
}

export function DebugBadge({ darkMode }: { darkMode: boolean }) {
  const [debug, setDebug] = useState<EnvironmentDebugResponse["debug"] | null>(null);

  useEffect(() => {
    let active = true;

    async function loadDebug() {
      const response = await fetch("/api/debug/environment", { cache: "no-store" });
      if (!response.ok) return;

      const data = (await response.json()) as EnvironmentDebugResponse;
      if (active && data.ok && data.debug) {
        setDebug(data.debug);
      }
    }

    void loadDebug().catch(() => {
      if (active) setDebug(null);
    });

    return () => {
      active = false;
    };
  }, []);

  if (!debug) return null;

  return (
    <div
      className="fixed bottom-3 right-3 z-50 rounded-md border px-2.5 py-1.5 text-[10px] leading-4 shadow-sm"
      style={{
        background: darkMode ? "#151820" : "#ffffff",
        borderColor: debug.productionSQLiteWarning ? "#f97316" : darkMode ? "#2a3050" : "#e5e7eb",
        color: darkMode ? "#cbd5e1" : "#374151",
      }}
      title="Environment diagnostics"
    >
      <div className="font-semibold" style={{ color: debug.productionSQLiteWarning ? "#f97316" : "inherit" }}>
        Env · {debug.shortCommitSha}
      </div>
      <div>DB: {debug.databaseDialect}</div>
      {!debug.databaseReachable && <div>DB error</div>}
      <div>Merchants: {debug.connectedMerchantCount}</div>
      <div>Demo: {debug.demoMode ? "true" : "false"}</div>
    </div>
  );
}
