export const DEFAULT_SYNC_INTERVAL_MINUTES = 5;

export interface AutoSyncSettings {
  autoSyncEnabled: boolean;
  syncIntervalMinutes?: number | null;
  nextSyncAt?: Date | string | null;
  lastSyncStatus?: string | null;
}

export type SyncStatus = "running" | "success" | "error" | "skipped";

export function syncIntervalMinutes(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_SYNC_INTERVAL_MINUTES;
}

export function nextSyncAt(from: Date, intervalMinutes: number | null | undefined): Date {
  return new Date(from.getTime() + syncIntervalMinutes(intervalMinutes) * 60 * 1000);
}

function timeMs(value: Date | string | null | undefined): number | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function shouldRunAutoSync(settings: AutoSyncSettings, now = new Date()): boolean {
  if (!settings.autoSyncEnabled) return false;
  if (settings.lastSyncStatus === "running") return false;

  const dueAt = timeMs(settings.nextSyncAt);
  return dueAt === null || dueAt <= now.getTime();
}

export function syncStatusUpdate(
  status: SyncStatus,
  now: Date,
  intervalMinutes: number | null | undefined,
  error?: string | null
) {
  return {
    lastSyncStatus: status,
    lastSyncAt: status === "success" || status === "error" ? now : null,
    nextSyncAt: status === "running" ? null : nextSyncAt(now, intervalMinutes),
    lastSyncError: status === "error" ? error ?? "Auto sync failed." : null,
  };
}

export class InMemorySyncLock {
  private readonly locks = new Set<string>();

  acquire(key: string): boolean {
    if (this.locks.has(key)) return false;
    this.locks.add(key);
    return true;
  }

  release(key: string): void {
    this.locks.delete(key);
  }
}
