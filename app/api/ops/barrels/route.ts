import { NextRequest, NextResponse } from "next/server";
import {
  closeOperationalBarrel,
  createOperationalBarrel,
  getOperationalSnapshot,
  saveProductCupMlMapping,
  updateOperationalBarrel,
  type OperationalContext,
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

type BarrelRoutePhase =
  | "request-validation"
  | "merchant-account-context"
  | "line-lookup"
  | "product-mapping-validation"
  | "barrel-insert"
  | "barrel-close"
  | "barrel-update"
  | "response-serialization";

function sanitizedErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return String(error ?? "Unknown error").slice(0, 500);
}

function sanitizedStack(error: unknown): string | undefined {
  if (!(error instanceof Error) || !error.stack) return undefined;
  return error.stack.split("\n").slice(0, 8).join("\n");
}

function logBarrelRouteFailure(
  message: string,
  error: unknown,
  context: {
    merchantId?: string;
    posProvider?: POSProvider;
    phase: BarrelRoutePhase;
    statusCode: number;
    lineId?: number;
    barrelId?: string;
  }
) {
  console.error(message, {
    merchantId: context.merchantId,
    posProvider: context.posProvider,
    phase: context.phase,
    statusCode: context.statusCode,
    lineId: context.lineId,
    barrelId: context.barrelId,
    sanitizedErrorMessage: sanitizedErrorMessage(error),
    sanitizedStack: sanitizedStack(error),
  });
}

export async function POST(request: NextRequest) {
  let phase: BarrelRoutePhase = "request-validation";
  let body: CreateBarrelPayload | null = null;
  let context: OperationalContext | null = null;

  try {
    body = (await request.json().catch(() => null)) as CreateBarrelPayload | null;

    if (!body?.line_id || !body.group_name || !body.volume_l || !body.price_paid) {
      return NextResponse.json({ ok: false, error: "line_id, group_name, volume_l, and price_paid are required." }, { status: 400 });
    }
    const payload = body as CreateBarrelPayload & {
      line_id: number;
      group_name: string;
      volume_l: number;
      price_paid: number;
    };

    phase = "merchant-account-context";
    const snapshot = await getOperationalSnapshot(payload.pos_provider);
    context = {
      merchantId: payload.merchant_id ?? snapshot.context.merchantId,
      posProvider: payload.pos_provider ?? snapshot.context.posProvider,
    };
    const externalProductIds = payload.external_product_ids ?? [];

    phase = "line-lookup";
    const lineExists = snapshot.lines.some((line) => line.lineNumber === payload.line_id);

    if (!lineExists) {
      return NextResponse.json({ ok: false, error: "line_id is not configured for this merchant." }, { status: 400 });
    }

    phase = "product-mapping-validation";
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

    console.info("Create local barrel request.", {
      merchantId: context.merchantId,
      posProvider: context.posProvider,
      lineId: payload.line_id,
      volumeL: payload.volume_l,
      volumeMl: Math.round(payload.volume_l * 1000),
      externalProductCount: externalProductIds.length,
    });

    phase = "barrel-insert";
    const nextSnapshot = await createOperationalBarrel(context, {
      lineId: payload.line_id,
      brand: payload.brand ?? payload.group_name,
      groupName: payload.group_name,
      beerStyle: payload.beer_style ?? null,
      abv: payload.abv ?? null,
      externalProductIds,
      volumeL: payload.volume_l,
      pricePaid: payload.price_paid,
      openedBy: payload.opened_by ?? null,
    });

    phase = "response-serialization";
    return NextResponse.json({ ok: true, snapshot: nextSnapshot });
  } catch (error) {
    if (error instanceof Error && error.message === "line_already_occupied") {
      return NextResponse.json({ ok: false, error: "Line already has an active barrel." }, { status: 409 });
    }

    logBarrelRouteFailure("Create local barrel failed.", error, {
      merchantId: context?.merchantId ?? body?.merchant_id,
      posProvider: context?.posProvider ?? body?.pos_provider,
      phase,
      statusCode: 500,
      lineId: body?.line_id,
    });

    return NextResponse.json({ ok: false, error: sanitizedErrorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let phase: BarrelRoutePhase = "request-validation";
  let body: UpdateBarrelPayload | null = null;
  let context: OperationalContext | null = null;

  try {
    body = (await request.json().catch(() => null)) as UpdateBarrelPayload | null;

    if (!body?.barrel_id) {
      return NextResponse.json({ ok: false, error: "barrel_id is required." }, { status: 400 });
    }
    const payload = body as UpdateBarrelPayload & { barrel_id: string };

    phase = "merchant-account-context";
    const snapshot = await getOperationalSnapshot(payload.pos_provider);
    context = {
      merchantId: payload.merchant_id ?? snapshot.context.merchantId,
      posProvider: payload.pos_provider ?? snapshot.context.posProvider,
    };

    phase = "line-lookup";
    const knownBarrel = snapshot.barrels.find((barrel) => barrel.id === payload.barrel_id);
    if (!knownBarrel) {
      return NextResponse.json({ ok: false, error: "Barrel not found for this merchant." }, { status: 404 });
    }

    if (payload.action === "close") {
      phase = "request-validation";
      if (typeof payload.merma_ml !== "number" || !Number.isFinite(payload.merma_ml) || payload.merma_ml < 0) {
        return NextResponse.json({ ok: false, error: "merma_ml is required and must be 0 or greater." }, { status: 400 });
      }

      if (!payload.closed_by?.trim()) {
        return NextResponse.json({ ok: false, error: "closed_by is required." }, { status: 400 });
      }

      phase = "barrel-close";
      const nextSnapshot = await closeOperationalBarrel(context, payload.barrel_id, {
        mermaMl: payload.merma_ml,
        closedBy: payload.closed_by,
      });

      phase = "response-serialization";
      return NextResponse.json({ ok: true, snapshot: nextSnapshot });
    }

    phase = "product-mapping-validation";
    const externalProductIds = payload.external_product_ids ?? knownBarrel.externalProductIds;
    const cupMlByExternalProductId = payload.cup_ml_by_external_product_id ?? {};
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

    phase = "barrel-update";
    const nextSnapshot = await updateOperationalBarrel(context, payload.barrel_id, {
      brand: payload.brand,
      groupName: payload.group_name,
      beerStyle: payload.beer_style,
      abv: payload.abv,
      externalProductIds: payload.external_product_ids,
      volumeL: payload.volume_l,
      pricePaid: payload.price_paid,
      openedBy: payload.opened_by,
    });

    phase = "response-serialization";
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

    logBarrelRouteFailure("Update local barrel failed.", error, {
      merchantId: context?.merchantId ?? body?.merchant_id,
      posProvider: context?.posProvider ?? body?.pos_provider,
      phase,
      statusCode: 500,
      barrelId: body?.barrel_id,
    });

    return NextResponse.json({ ok: false, error: sanitizedErrorMessage(error) }, { status: 500 });
  }
}
