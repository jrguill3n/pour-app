import { NextRequest, NextResponse } from "next/server";
import {
  closeOperationalBarrel,
  createOperationalBarrel,
  getOperationalSnapshot,
  saveProductCupMlMapping,
  updateOperationalBarrel,
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

interface UpdateBarrelPayload {
  action?: "update" | "close";
  merchant_id?: string;
  pos_provider?: POSProvider;
  barrel_id?: string;
  brand?: string | null;
  group_name?: string | null;
  beer_style?: string | null;
  abv?: number | null;
  external_product_ids?: string[];
  volume_l?: number | null;
  price_paid?: number | null;
  opened_by?: string | null;
  closed_by?: string | null;
  merma_ml?: number;
  cup_ml_by_external_product_id?: Record<string, number>;
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

export async function PATCH(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as UpdateBarrelPayload | null;

  if (!body?.barrel_id) {
    return NextResponse.json({ ok: false, error: "barrel_id is required." }, { status: 400 });
  }

  const snapshot = await getOperationalSnapshot(body.pos_provider);
  const context = {
    merchantId: body.merchant_id ?? snapshot.context.merchantId,
    posProvider: body.pos_provider ?? snapshot.context.posProvider,
  };

  const knownBarrel = snapshot.barrels.find((barrel) => barrel.id === body.barrel_id);
  if (!knownBarrel) {
    return NextResponse.json({ ok: false, error: "Barrel not found for this merchant." }, { status: 404 });
  }

  if (body.action === "close") {
    if (typeof body.merma_ml !== "number" || !Number.isFinite(body.merma_ml) || body.merma_ml < 0) {
      return NextResponse.json({ ok: false, error: "merma_ml is required and must be 0 or greater." }, { status: 400 });
    }

    if (!body.closed_by?.trim()) {
      return NextResponse.json({ ok: false, error: "closed_by is required." }, { status: 400 });
    }

    try {
      const nextSnapshot = await closeOperationalBarrel(context, body.barrel_id, {
        mermaMl: body.merma_ml,
        closedBy: body.closed_by,
      });

      return NextResponse.json({ ok: true, snapshot: nextSnapshot });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("barrel_close_invalid:")) {
        return NextResponse.json(
          { ok: false, error: "Barrel close validation failed.", details: error.message.replace("barrel_close_invalid:", "").split("|") },
          { status: 400 }
        );
      }

      if (error instanceof Error && error.message === "barrel_not_found") {
        return NextResponse.json({ ok: false, error: "Barrel not found for this merchant." }, { status: 404 });
      }

      throw error;
    }
  }

  const externalProductIds = body.external_product_ids ?? knownBarrel.externalProductIds;
  const cupMlByExternalProductId = body.cup_ml_by_external_product_id ?? {};
  const missingCupMl = findMappedProductsMissingCupMl(externalProductIds, snapshot.products, cupMlByExternalProductId);

  if (missingCupMl.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "cup_ml is required for every linked product before saving barrel mappings.",
        missing_external_product_ids: missingCupMl,
      },
      { status: 400 }
    );
  }

  for (const [externalProductId, cupMl] of Object.entries(cupMlByExternalProductId)) {
    if (Number.isFinite(cupMl) && cupMl > 0) {
      await saveProductCupMlMapping(context, externalProductId, cupMl);
    }
  }

  const nextSnapshot = await updateOperationalBarrel(context, body.barrel_id, {
    brand: body.brand,
    groupName: body.group_name,
    beerStyle: body.beer_style,
    abv: body.abv,
    externalProductIds: body.external_product_ids,
    volumeL: body.volume_l,
    pricePaid: body.price_paid,
    openedBy: body.opened_by,
  });

  return NextResponse.json({ ok: true, snapshot: nextSnapshot });
}
