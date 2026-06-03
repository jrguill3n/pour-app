import { describe, expect, it } from "vitest";
import {
  InMemorySyncLock,
  nextSyncAt,
  shouldRunAutoSync,
  syncStatusUpdate,
} from "./scheduler-boundary";

describe("auto sync scheduler boundary", () => {
  const now = new Date("2026-06-03T10:00:00.000Z");

  it("runs auto-sync when enabled and due", () => {
    expect(
      shouldRunAutoSync({
        autoSyncEnabled: true,
        syncIntervalMinutes: 5,
        nextSyncAt: "2026-06-03T09:59:00.000Z",
      }, now)
    ).toBe(true);
  });

  it("does not run auto-sync when disabled", () => {
    expect(
      shouldRunAutoSync({
        autoSyncEnabled: false,
        syncIntervalMinutes: 5,
        nextSyncAt: "2026-06-03T09:59:00.000Z",
      }, now)
    ).toBe(false);
  });

  it("prevents overlapping sync jobs with an in-memory lock", () => {
    const lock = new InMemorySyncLock();

    expect(lock.acquire("poster:624548")).toBe(true);
    expect(lock.acquire("poster:624548")).toBe(false);
    lock.release("poster:624548");
    expect(lock.acquire("poster:624548")).toBe(true);
  });

  it("creates success status updates with last and next sync timestamps", () => {
    expect(syncStatusUpdate("success", now, 5)).toEqual({
      lastSyncStatus: "success",
      lastSyncAt: now,
      nextSyncAt: nextSyncAt(now, 5),
      lastSyncError: null,
    });
  });

  it("creates error status updates with a visible error message", () => {
    expect(syncStatusUpdate("error", now, 5, "Poster unavailable")).toEqual({
      lastSyncStatus: "error",
      lastSyncAt: now,
      nextSyncAt: nextSyncAt(now, 5),
      lastSyncError: "Poster unavailable",
    });
  });
});
