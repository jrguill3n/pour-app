import { NextRequest, NextResponse } from "next/server";
import {
  createOperationalBarrel,
  getOperationalSnapshot,
} from "@/lib/db/repositories/operations";
import { findMappedProductsMissingCupMl } from "@/lib/db/repositories/operations-boundary";
import type { POSProvider } from "@/lib/pos/types";

interface CreateBarrelPayload {
  merchant_id?: string;
  pos_provider?: POSProvider;
  line_id?: number;
  brand?: string;
  group_name?: string;
  beer_style?: string | null;
  abv?: number | null;
  external_product_ids?: string[];
  volume_l?: number;
  price_paid?: number;
  opened_by?: string | null;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CreateBarrelPayload | null;

  if (!body?.line_id || !body.group_name || !body.volume_l || !body.price_paid) {
    return NextResponse.json({ ok: false, error: "line_id, group_name, volume_l, and price_paid are required." }, { status: 400 });
  }

  const snapshot = await getOperationalSnapshot(body.pos_provider);
  const context = {
    merchantId: body.merchant_id ?? snapshot.context.merchantId,
    posProvider: body.pos_provider ?? snapshot.context.posProvider,
  };
  const externalProductIds = body.external_product_ids ?? [];
  const lineExists = snapshot.lines.some((line) => line.lineNumber === body.line_id);

  if (!lineExists) {
    return NextResponse.json({ ok: false, error: "line_id is not configured for this merchant." }, { status: 400 });
  }

  if (externalProductIds.length === 0) {
    return NextResponse.json({ ok: false, error: "At least one linked product is required." }, { status: 400 });
  }

  const missingCupMl = findMappedProductsMissingCupMl(externalProductIds, snapshot.products, {});

  if (missingCupMl.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "cup_ml is required for every linked product before opening a barrel.",
        missing_external_product_ids: missingCupMl,
      },
      { status: 400 }
    );
  }

  try {
    console.info("Create local barrel request.", {
      merchantId: context.merchantId,
      posProvider: context.posProvider,
      lineId: body.line_id,
      volumeL: body.volume_l,
      volumeMl: Math.round(body.volume_l * 1000),
      externalProductCount: externalProductIds.length,
    });
    const nextSnapshot = await createOperationalBarrel(context, {
      lineId: body.line_id,
      brand: body.brand ?? body.group_name,
      groupName: body.group_name,
      beerStyle: body.beer_style ?? null,
      abv: body.abv ?? null,
      externalProductIds,
      volumeL: body.volume_l,
      pricePaid: body.price_paid,
      openedBy: body.opened_by ?? null,
    });

    return NextResponse.json({ ok: true, snapshot: nextSnapshot });
  } catch (error) {
    if (error instanceof Error && error.message === "line_already_occupied") {
      return NextResponse.json({ ok: false, error: "Line already has an active barrel." }, { status: 409 });
    }

    throw error;
  }
}
