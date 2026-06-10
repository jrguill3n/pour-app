import { describe, expect, it, vi } from "vitest";
import { runManualPosSync } from "./manual";

vi.mock("./poster", () => ({
  syncPosterManual: vi.fn(),
}));

describe("manual POS sync dispatcher", () => {
  it("keeps mock sync explicitly in demo mode", async () => {
    await expect(runManualPosSync({ provider: "mock" })).resolves.toEqual({
      mode: "demo",
      message: "Demo mode is already seeded; no external POS sync was run.",
    });
  });

  it("does not silently treat unsupported real providers as demo", async () => {
    await expect(runManualPosSync({ provider: "square" })).rejects.toThrow(
      "Manual sync is not implemented for provider square."
    );
  });
});
