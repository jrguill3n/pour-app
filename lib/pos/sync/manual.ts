import { syncPosterManual, type PosterManualSyncResult, type PosterSyncInput } from "./poster";
import type { POSProvider } from "@/lib/pos/types";

export interface ManualSyncInput extends PosterSyncInput {
  provider: POSProvider;
}

export type ManualSyncResult = PosterManualSyncResult | {
  mode: "demo";
  message: string;
};

export function runManualPosSync(input: ManualSyncInput & { provider: "poster" }): Promise<PosterManualSyncResult>;
export function runManualPosSync(input: ManualSyncInput): Promise<ManualSyncResult>;
export async function runManualPosSync(input: ManualSyncInput): Promise<ManualSyncResult> {
  if (input.provider === "poster") {
    return syncPosterManual({
      posAccountId: input.posAccountId,
      from: input.from,
      to: input.to,
    });
  }

  if (input.provider === "mock") {
    return {
      mode: "demo",
      message: "Demo mode is already seeded; no external POS sync was run.",
    };
  }

  throw new Error(`Manual sync is not implemented for provider ${input.provider}.`);
}
