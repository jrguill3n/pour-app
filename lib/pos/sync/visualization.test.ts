import { describe, expect, it } from "vitest";
import {
  syncHealth,
  syncModeLabel,
  syncSummary,
  syncTimeline,
  type SyncLogView,
} from "./visualization";

describe("sync visualization", () => {
  it("builds a successful sync summary from catalog and transaction logs", () => {
    expect(
      syncSummary([
        {
          id: "catalog",
          dataType: "catalog",
          lastPolledAt: "2026-06-03T10:00:00.000Z",
          lastSyncedAt: "2026-06-03T10:00:05.000Z",
          updatedAt: "2026-06-03T10:00:05.000Z",
          raw: { products: 148, locations: 1, employees: 2 },
        },
        {
          id: "transactions",
          dataType: "transactions",
          lastPolledAt: "2026-06-03T10:00:05.000Z",
          lastSyncedAt: "2026-06-03T10:00:09.000Z",
          updatedAt: "2026-06-03T10:00:09.000Z",
          raw: { transactions: 11, activeBarrels: 1 },
        },
      ])
    ).toEqual({
      products: 148,
      locations: 1,
      employees: 2,
      transactions: 11,
      activeBarrels: 1,
    });
  });

  it("maps failed account sync status to failed health", () => {
    expect(
      syncHealth({
        autoSyncEnabled: true,
        syncIntervalMinutes: 5,
        lastSyncAt: "2026-06-03T10:00:00.000Z",
        nextSyncAt: "2026-06-03T10:05:00.000Z",
        lastSyncStatus: "error",
        lastSyncError: "Poster unavailable",
      })
    ).toBe("failed");
  });

  it("maps overlapping sync prevention to skipped health", () => {
    expect(
      syncHealth({
        autoSyncEnabled: true,
        syncIntervalMinutes: 5,
        lastSyncAt: null,
        nextSyncAt: "2026-06-03T10:05:00.000Z",
        lastSyncStatus: "skipped",
        lastSyncError: "Previous sync is still running.",
      })
    ).toBe("skipped");
  });

  it("formats current mode with next sync interval context", () => {
    expect(
      syncModeLabel({
        autoSyncEnabled: true,
        syncIntervalMinutes: 5,
        lastSyncAt: null,
        nextSyncAt: "2026-06-03T10:05:00.000Z",
        lastSyncStatus: null,
        lastSyncError: null,
      })
    ).toBe("Auto-sync ON · Every 5 minutes");
  });

  it("returns only the last 5 sync logs in newest-first order", () => {
    const logs: SyncLogView[] = Array.from({ length: 7 }, (_, index) => ({
      id: `sync-${index}`,
      dataType: "transactions",
      lastPolledAt: `2026-06-03T10:0${index}:00.000Z`,
      lastSyncedAt: `2026-06-03T10:0${index}:05.000Z`,
      updatedAt: `2026-06-03T10:0${index}:05.000Z`,
      raw: { status: "completed", transactions: index },
    }));

    expect(syncTimeline(logs, 5).map((item) => item.id)).toEqual([
      "sync-6",
      "sync-5",
      "sync-4",
      "sync-3",
      "sync-2",
    ]);
  });
});
