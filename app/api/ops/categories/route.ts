import { NextRequest, NextResponse } from "next/server";
import {
  getOperationalSnapshot,
  saveDraftCategoryEligibility,
} from "@/lib/db/repositories/operations";
import type { POSProvider } from "@/lib/pos/types";

interface CategoryPayload {
  merchant_id?: string;
  pos_provider?: POSProvider;
  eligible_external_category_ids?: string[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CategoryPayload | null;
  const snapshot = await getOperationalSnapshot(body?.pos_provider);
  const context = {
    merchantId: body?.merchant_id ?? snapshot.context.merchantId,
    posProvider: body?.pos_provider ?? snapshot.context.posProvider,
  };
  const eligibleIds = new Set(body?.eligible_external_category_ids ?? []);

  await saveDraftCategoryEligibility(
    context,
    snapshot.productCategories.map((category) => ({
      externalCategoryId: category.externalCategoryId,
      name: category.name,
      isDraftEligible: eligibleIds.has(category.externalCategoryId),
    }))
  );

  const nextSnapshot = await getOperationalSnapshot(context.posProvider);
  return NextResponse.json({ ok: true, snapshot: nextSnapshot });
}
