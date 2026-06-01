import { NextRequest, NextResponse } from "next/server";
import {
  getOperationalSnapshot,
  saveBarrelProductMapping,
  saveProductCupMlMapping,
} from "@/lib/db/repositories/operations";
import type { POSProvider } from "@/lib/pos/types";

interface MappingPayload {
  merchant_id?: string;
  pos_provider?: POSProvider;
  barrel_id?: string;
  external_product_ids?: string[];
  cup_ml_by_external_product_id?: Record<string, number>;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as MappingPayload | null;

  if (!body?.barrel_id) {
    return NextResponse.json({ ok: false, error: "barrel_id is required." }, { status: 400 });
  }

  const snapshot = await getOperationalSnapshot(body.pos_provider);
  const context = {
    merchantId: body.merchant_id ?? snapshot.context.merchantId,
    posProvider: body.pos_provider ?? snapshot.context.posProvider,
  };
  const externalProductIds = body.external_product_ids ?? [];

  await saveBarrelProductMapping(context, body.barrel_id, externalProductIds);

  const cupMlEntries = Object.entries(body.cup_ml_by_external_product_id ?? {}).filter(
    ([, value]) => Number.isFinite(value) && value > 0
  );
  await Promise.all(
    cupMlEntries.map(([externalProductId, cupMl]) =>
      saveProductCupMlMapping(context, externalProductId, Math.round(cupMl))
    )
  );

  const nextSnapshot = await getOperationalSnapshot(context.posProvider);
  return NextResponse.json({ ok: true, snapshot: nextSnapshot });
}
