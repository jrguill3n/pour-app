export interface SyncAccountView {
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export interface SyncLogView {
  id: string;
  dataType: string;
  lastPolledAt: string | null;
  lastSyncedAt: string | null;
  raw: unknown;
  updatedAt: string;
}

export interface SyncSummary {
  products: number;
  locations: number;
  employees: number;
  transactions: number;
  activeBarrels: number;
}

export interface SyncTimelineItem {
  id: string;
  time: string | null;
  status: "idle" | "running" | "success" | "failed" | "skipped";
  label: string;
  duration: string;
  transactions: number;
  error: string | null;
}

function rawRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
}

function numericRawValue(raw: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = raw[key];
    const numeric = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function dateMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function syncHealth(account: SyncAccountView | null, syncing = false): SyncTimelineItem["status"] {
  if (syncing || account?.lastSyncStatus === "running") return "running";
  if (account?.lastSyncStatus === "error") return "failed";
  if (account?.lastSyncStatus === "skipped") return "skipped";
  if (account?.lastSyncStatus === "success") return "success";
  return "idle";
}

export function syncHealthLabel(status: SyncTimelineItem["status"]): string {
  if (status === "running") return "Running";
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped because another sync is running";
  return "Idle";
}

export function syncModeLabel(account: SyncAccountView | null): string {
  if (!account?.autoSyncEnabled) return "Auto-sync OFF";
  return `Auto-sync ON · Every ${account.syncIntervalMinutes || 5} minutes`;
}

export function formatSyncDuration(start: string | null | undefined, end: string | null | undefined): string {
  const startMs = dateMs(start);
  const endMs = dateMs(end);
  if (startMs === null || endMs === null || endMs < startMs) return "-";

  const seconds = Math.round((endMs - startMs) / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}

export function syncSummary(logs: SyncLogView[]): SyncSummary {
  const latestByType = new Map<string, SyncLogView>();
  for (const log of [...logs].sort((a, b) => (dateMs(b.updatedAt) ?? 0) - (dateMs(a.updatedAt) ?? 0))) {
    if (!latestByType.has(log.dataType)) {
      latestByType.set(log.dataType, log);
    }
  }

  const catalogRaw = rawRecord(latestByType.get("catalog")?.raw);
  const transactionRaw = rawRecord(latestByType.get("transactions")?.raw);

  return {
    products: numericRawValue(catalogRaw, ["products"]),
    locations: numericRawValue(catalogRaw, ["locations"]),
    employees: numericRawValue(catalogRaw, ["employees"]),
    transactions: numericRawValue(transactionRaw, ["transactions_processed", "transactions"]),
    activeBarrels: numericRawValue(transactionRaw, ["active_barrels_recalculated", "activeBarrels"]),
  };
}

export function syncTimeline(logs: SyncLogView[], limit = 5): SyncTimelineItem[] {
  return [...logs]
    .sort((a, b) => (dateMs(b.updatedAt) ?? 0) - (dateMs(a.updatedAt) ?? 0))
    .slice(0, limit)
    .map((log) => {
      const raw = rawRecord(log.raw);
      const rawStatus = String(raw.status ?? "").toLowerCase();
      const error = typeof raw.error === "string" ? raw.error : null;
      const status =
        rawStatus === "running"
          ? "running"
          : rawStatus === "skipped"
            ? "skipped"
            : error || rawStatus === "error" || log.dataType.includes("error")
              ? "failed"
              : "success";

      return {
        id: log.id,
        time: log.updatedAt ?? log.lastSyncedAt,
        status,
        label: syncHealthLabel(status),
        duration: formatSyncDuration(log.lastPolledAt, log.lastSyncedAt),
        transactions: numericRawValue(raw, ["transactions_processed", "transactions"]),
        error,
      };
    });
}
