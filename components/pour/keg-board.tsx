"use client";

import { useEffect, useState } from "react";
import { getKegBoardInitialState } from "@/lib/repositories/mock-pour-repository";
import { volumeMlToVolumeL } from "@/lib/db/repositories/operations-boundary";
import { closedBarrelHistoryWarnings } from "@/lib/core/barrel-close";
import type { Barrel, BarrelEditFields, Line, Template, BarConfig, MenuConfig, Product } from "@/lib/core/types";
import type { POSProvider } from "@/lib/pos/types";
import { remPct, yPct, yColor } from "@/lib/pour-utils";
import { PourLogo } from "./pour-logo";
import { LineCard } from "./line-card";
import { DetailPanel } from "./detail-panel";
import { DashboardTab } from "./dashboard-tab";
import { OperationsTab } from "./operations-tab";
import { DebugBadge } from "./debug-badge";
import { ProductSelector } from "./product-selector";

const initialState = getKegBoardInitialState();

interface OperationalStatusResponse {
  ok: boolean;
  snapshot?: {
    mode: "demo" | "connected";
    context: {
      merchantId: string;
      posProvider: string;
    };
    lines: Array<{
      id: string;
      merchantId: string;
      posProvider: string;
      lineNumber: number;
      note: string | null;
    }>;
    products: Array<{
      id: string;
      merchantId: string;
      posProvider: string;
      externalProductId: string;
      name: string;
      categoryId: string | null;
      categoryName: string | null;
      externalCategoryId: string | null;
      parentExternalProductId: string | null;
      parentProductName: string | null;
      variantExternalId: string | null;
      variantName: string | null;
      cupMl: number | null;
      priceCents: number | null;
    }>;
    mappingProducts: Array<{
      id: string;
      merchantId: string;
      posProvider: string;
      externalProductId: string;
      name: string;
      categoryId: string | null;
      categoryName: string | null;
      externalCategoryId: string | null;
      parentExternalProductId: string | null;
      parentProductName: string | null;
      variantExternalId: string | null;
      variantName: string | null;
      cupMl: number | null;
      priceCents: number | null;
    }>;
    barrels: Array<{
      id: string;
      merchantId: string;
      posProvider: string;
      lineId: number | null;
      kegId: string | null;
      brand: string | null;
      groupName: string | null;
      beerStyle: string | null;
      abvBasisPoints: number | null;
      externalProductIds: string[];
      volumeMl: number;
      pricePaidCents: number | null;
      mlConsumed: number;
      mermaMl: number;
      revenueBrutoCents: number;
      revenueDescuentosCents: number;
      revenueNetoCents: number;
      status: string;
      openedAt: string | null;
      openedBy: string | null;
      closedAt: string | null;
      closedBy: string | null;
    }>;
  };
}

function lineFromOperational(
  line: NonNullable<OperationalStatusResponse["snapshot"]>["lines"][number]
): Line {
  return {
    id: line.lineNumber,
    note: line.note ?? "",
  };
}

function productFromOperational(
  product: NonNullable<OperationalStatusResponse["snapshot"]>["products"][number],
  index: number
): Product {
  return {
    id: Number.isFinite(Number(product.externalProductId)) ? Number(product.externalProductId) : index + 1,
    external_product_id: product.externalProductId,
    pos_provider: product.posProvider as POSProvider,
    merchant_id: product.merchantId,
    name: product.name,
    description: null,
    category_id: product.categoryId,
    category_name: product.categoryName,
    external_category_id: product.externalCategoryId,
    parent_external_product_id: product.parentExternalProductId,
    parent_product_name: product.parentProductName,
    variant_external_id: product.variantExternalId,
    variant_name: product.variantName,
    price_cents: product.priceCents,
    cup_ml: product.cupMl,
    brand: product.parentProductName ?? product.name,
    variant: product.variantName
      ? `${product.variantName} · parent: ${product.parentProductName ?? product.name}`
      : product.name,
    cupMl: product.cupMl ?? 0,
    raw: null,
  };
}

function barrelFromOperational(
  barrel: NonNullable<OperationalStatusResponse["snapshot"]>["barrels"][number],
  index: number
): Barrel {
  return {
    id: Number.isFinite(Number(barrel.id)) ? Number(barrel.id) : index + 1,
    dbId: barrel.id,
    kegId: barrel.kegId ?? barrel.id,
    location_id: null,
    lineId: barrel.lineId,
    brand: barrel.brand ?? barrel.groupName ?? "Barril",
    group: barrel.groupName ?? barrel.brand ?? "Barril",
    beerStyle: barrel.beerStyle ?? "",
    abv: barrel.abvBasisPoints ? barrel.abvBasisPoints / 100 : null,
    external_product_ids: barrel.externalProductIds,
    pos_provider: barrel.posProvider as POSProvider,
    volumeL: volumeMlToVolumeL(barrel.volumeMl),
    volumeMl: barrel.volumeMl,
    pricePaid: (barrel.pricePaidCents ?? 0) / 100,
    pricePaidCents: barrel.pricePaidCents,
    openedAt: barrel.openedAt,
    openedBy: barrel.openedBy ?? "",
    status: barrel.status === "closed" ? "closed" : barrel.status === "reserve" ? "reserve" : "active",
    mlConsumed: barrel.mlConsumed,
    mermaMl: barrel.mermaMl,
    closedAt: barrel.closedAt,
    closedBy: barrel.closedBy,
    revenueBrutoCents: barrel.revenueBrutoCents,
    revenueDescuentosCents: barrel.revenueDescuentosCents,
    revenueNetoCents: barrel.revenueNetoCents,
  };
}

export function KegBoard() {
  const [tab, setTab] = useState<"dashboard" | "board" | "templates" | "history" | "operations" | "config" | "menu">("board");
  const [darkMode, setDarkMode] = useState(false);
  const [boardView, setBoardView] = useState<"grid" | "list">("grid");
  const [dataMode, setDataMode] = useState<"demo" | "connected" | null>(null);
  const [operationalContext, setOperationalContext] = useState<NonNullable<OperationalStatusResponse["snapshot"]>["context"] | null>(null);
  const [products, setProducts] = useState(initialState.products);
  const [barrels, setBarrels] = useState<Barrel[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(1);
  const [reserveFormOpen, setReserveFormOpen] = useState(false);
  const [reserveEditId, setReserveEditId] = useState<number | null>(null);
  const [reserveActivateLineById, setReserveActivateLineById] = useState<Record<number, number | null>>({});
  const [reserveErrors, setReserveErrors] = useState<Record<number | "create", string | null>>({ create: null });
  const [reserveForm, setReserveForm] = useState({
    brand: "",
    group: "",
    beerStyle: "",
    abv: "",
    external_product_ids: [] as string[],
    volumeL: "",
    pricePaid: "",
    notes: "",
  });
  const [reserveEditForm, setReserveEditForm] = useState({
    brand: "",
    group: "",
    beerStyle: "",
    abv: "",
    external_product_ids: [] as string[],
    volumeL: "",
    pricePaid: "",
  });
  const [barConfig, setBarConfig] = useState<BarConfig>(initialState.barConfig);
  const [_menuConfig] = useState<MenuConfig>(initialState.menuConfig);
  const currentEmployee = initialState.employees[0];

  useEffect(() => {
    let active = true;

    async function loadDataMode() {
      const response = await fetch("/api/ops/status", { cache: "no-store" });
      const data = (await response.json()) as OperationalStatusResponse;
      const nextMode = data.snapshot?.mode ?? "demo";

      if (!active) return;

      setDataMode(nextMode);
      setOperationalContext(data.snapshot?.context ?? null);
      if (nextMode === "demo") {
        setProducts(initialState.products);
        setBarrels(initialState.barrels);
        setTemplates(initialState.templates);
        setLines(initialState.lines);
        return;
      }

      setLines((data.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((data.snapshot?.barrels ?? []).map(barrelFromOperational));
      setTemplates([]);
      setProducts((data.snapshot?.mappingProducts ?? []).map(productFromOperational));
      console.info("Create Keg product selector diagnostics.", {
        mode: nextMode,
        merchantId: data.snapshot?.context.merchantId,
        posProvider: data.snapshot?.context.posProvider,
        linesReturnedToBoard: data.snapshot?.lines.length ?? 0,
        barrelsReturnedToBoard: data.snapshot?.barrels.length ?? 0,
        occupiedLines: (data.snapshot?.barrels ?? []).filter((barrel) => barrel.status === "active").map((barrel) => barrel.lineId),
        productsReturnedToSelector: data.snapshot?.mappingProducts.length ?? 0,
      });
    }

    void loadDataMode().catch((error) => {
      if (!active) return;
      console.warn("Could not load operational status; refusing to show seeded demo data as a fallback.", {
        message: error instanceof Error ? error.message : "Unknown status error",
      });
      setDataMode(null);
      setProducts([]);
      setBarrels([]);
      setTemplates([]);
      setLines([]);
    });

    return () => {
      active = false;
    };
  }, []);

  const getBarrel = (lineId: number) =>
    barrels.find((b) => b.lineId === lineId && b.status === "active");
  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const selectedBarrel = selectedLineId ? getBarrel(selectedLineId) : undefined;

  const activeCount = lines.filter((l) => getBarrel(l.id)).length;
  const reserveBarrels = barrels.filter((barrel) => barrel.status === "reserve");
  const emptyLines = lines.filter((line) => !getBarrel(line.id));
  const lowCount = lines.filter((l) => {
    const b = getBarrel(l.id);
    return b && remPct(b.mlConsumed, b.volumeL * 1000) < 20;
  }).length;
  const emptyCount = lines.length - activeCount;

  async function handleOpen(
    lineId: number,
    data: {
      brand: string;
      group: string;
      beerStyle?: string;
      abv?: number | null;
      external_product_ids: string[];
      volumeL: number;
      pricePaid: number;
      openedBy: string;
    }
  ) {
    if (dataMode === "connected" && operationalContext) {
      const response = await fetch("/api/ops/barrels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          line_id: lineId,
          brand: data.brand,
          group_name: data.group,
          beer_style: data.beerStyle ?? null,
          abv: data.abv ?? null,
          external_product_ids: data.external_product_ids,
          volume_l: data.volumeL,
          price_paid: data.pricePaid,
          opened_by: data.openedBy,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string };

      if (!response.ok || !result.ok) {
        console.warn("Could not open local barrel.", { error: result.error, lineId });
        return;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
      return;
    }

    const kegId = `KEG-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
    setBarrels((bs) => [
      ...bs,
      {
        id: Date.now(),
        kegId,
        lineId,
        brand: data.brand,
        group: data.group,
        beerStyle: data.beerStyle || "",
        abv: data.abv || null,
        external_product_ids: data.external_product_ids,
        pos_provider: "mock",
        location_id: null,
        volumeL: data.volumeL,
        volumeMl: Math.round(data.volumeL * 1000),
        pricePaid: data.pricePaid,
        pricePaidCents: Math.round(data.pricePaid * 100),
        openedAt: new Date().toISOString(),
        openedBy: data.openedBy,
        status: "active",
        mlConsumed: 0,
        mermaMl: 0,
        closedAt: null,
        closedBy: null,
      },
    ]);
  }

  async function handleCreateReserve() {
    setReserveErrors((items) => ({ ...items, create: null }));
    const volumeL = reserveForm.volumeL ? parseFloat(reserveForm.volumeL) : null;
    const pricePaid = reserveForm.pricePaid ? parseFloat(reserveForm.pricePaid) : null;
    const payload = {
      status: "reserve",
      brand: reserveForm.brand || null,
      group_name: reserveForm.group || null,
      beer_style: reserveForm.beerStyle || null,
      abv: reserveForm.abv ? parseFloat(reserveForm.abv) : null,
      external_product_ids: reserveForm.external_product_ids,
      volume_l: Number.isFinite(volumeL) ? volumeL : null,
      price_paid: Number.isFinite(pricePaid) ? pricePaid : null,
      opened_by: currentEmployee,
      notes: reserveForm.notes || null,
    };

    if (dataMode === "connected" && operationalContext) {
      const response = await fetch("/api/ops/barrels", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          ...payload,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string };

      if (!response.ok || !result.ok) {
        setReserveErrors((items) => ({ ...items, create: result.error ?? "No se pudo crear la reserva." }));
        return false;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
    } else {
      const now = new Date().toISOString();
      setBarrels((items) => [
        ...items,
        {
          id: Date.now(),
          kegId: `RES-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
          lineId: null,
          brand: reserveForm.brand || "Reserva",
          group: reserveForm.group || "Barril de reserva",
          beerStyle: reserveForm.beerStyle || "",
          abv: reserveForm.abv ? parseFloat(reserveForm.abv) : null,
          external_product_ids: reserveForm.external_product_ids,
          pos_provider: "mock",
          location_id: null,
          volumeL: Number.isFinite(volumeL) && volumeL ? volumeL : 0,
          volumeMl: Number.isFinite(volumeL) && volumeL ? Math.round(volumeL * 1000) : 0,
          pricePaid: Number.isFinite(pricePaid) && pricePaid ? pricePaid : 0,
          pricePaidCents: Number.isFinite(pricePaid) && pricePaid !== null ? Math.round(pricePaid * 100) : null,
          openedAt: null,
          openedBy: "",
          status: "reserve",
          mlConsumed: 0,
          mermaMl: 0,
          closedAt: null,
          closedBy: null,
          editedAt: now,
          editedBy: currentEmployee,
        },
      ]);
    }

    setReserveForm({
      brand: "",
      group: "",
      beerStyle: "",
      abv: "",
      external_product_ids: [],
      volumeL: "",
      pricePaid: "",
      notes: "",
    });
    setReserveFormOpen(false);
    return true;
  }

  async function handleActivateReserve(barrelId: number, destinationLineId: number) {
    const currentBarrel = barrels.find((barrel) => barrel.id === barrelId);
    if (!currentBarrel) return false;

    if (currentBarrel.external_product_ids.length === 0) {
      setReserveErrors((items) => ({ ...items, [barrelId]: "Agrega al menos un producto vinculado antes de activar." }));
      return false;
    }

    const missingCupMl = products
      .filter((product) => currentBarrel.external_product_ids.includes(product.external_product_id))
      .filter((product) => !Number.isFinite(product.cupMl) || product.cupMl <= 0)
      .map((product) => product.variant);

    if (missingCupMl.length > 0) {
      setReserveErrors((items) => ({ ...items, [barrelId]: "Configura cup_ml para los productos vinculados antes de activar." }));
      return false;
    }

    if (getBarrel(destinationLineId)) {
      setReserveErrors((items) => ({ ...items, [barrelId]: "La línea destino ya está ocupada." }));
      return false;
    }

    if (dataMode === "connected" && operationalContext) {
      if (!currentBarrel.dbId) return false;
      const response = await fetch("/api/ops/barrels", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "activate",
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          barrel_id: currentBarrel.dbId,
          destination_line_id: destinationLineId,
          activated_by: currentEmployee,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string };

      if (!response.ok || !result.ok) {
        setReserveErrors((items) => ({ ...items, [barrelId]: result.error ?? "No se pudo activar la reserva." }));
        return false;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
      setSelectedLineId(destinationLineId);
    } else {
      const now = new Date().toISOString();
      setBarrels((items) =>
        items.map((barrel) =>
          barrel.id === barrelId
            ? {
                ...barrel,
                lineId: destinationLineId,
                status: "active",
                openedAt: now,
                openedBy: currentEmployee,
                editedAt: now,
                editedBy: currentEmployee,
              }
            : barrel
        )
      );
      setSelectedLineId(destinationLineId);
    }

    setReserveErrors((items) => ({ ...items, [barrelId]: null }));
    setReserveActivateLineById((items) => ({ ...items, [barrelId]: null }));
    return true;
  }

  function startReserveEdit(barrel: Barrel) {
    setReserveEditId(barrel.id);
    setReserveEditForm({
      brand: barrel.brand ?? "",
      group: barrel.group ?? "",
      beerStyle: barrel.beerStyle ?? "",
      abv: barrel.abv ? String(barrel.abv) : "",
      external_product_ids: barrel.external_product_ids,
      volumeL: barrel.volumeMl && barrel.volumeMl > 0 ? String(barrel.volumeMl / 1000) : "",
      pricePaid: barrel.pricePaidCents !== null && barrel.pricePaidCents !== undefined ? String(barrel.pricePaidCents / 100) : "",
    });
    setReserveErrors((items) => ({ ...items, [barrel.id]: null }));
  }

  async function handleSaveReserveEdit(barrelId: number) {
    const volumeL = reserveEditForm.volumeL ? parseFloat(reserveEditForm.volumeL) : null;
    const pricePaid = reserveEditForm.pricePaid ? parseFloat(reserveEditForm.pricePaid) : null;
    const ok = await handleEdit(barrelId, {
      brand: reserveEditForm.brand || undefined,
      group: reserveEditForm.group || undefined,
      beerStyle: reserveEditForm.beerStyle || undefined,
      abv: reserveEditForm.abv ? parseFloat(reserveEditForm.abv) : null,
      external_product_ids: reserveEditForm.external_product_ids,
      volumeL: Number.isFinite(volumeL) ? volumeL : null,
      pricePaid: Number.isFinite(pricePaid) ? pricePaid : null,
    });

    if (ok === false) {
      setReserveErrors((items) => ({ ...items, [barrelId]: "No se pudo guardar la reserva." }));
      return false;
    }

    setReserveEditId(null);
    return true;
  }

  async function handleClose(barrelId: number, mermaMl: number, closedBy: string) {
    if (dataMode === "connected" && operationalContext) {
      const currentBarrel = barrels.find((barrel) => barrel.id === barrelId);
      if (!currentBarrel?.dbId) {
        console.warn("Could not close local barrel because the persisted id is missing.", { barrelId });
        return false;
      }

      const response = await fetch("/api/ops/barrels", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "close",
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          barrel_id: currentBarrel.dbId,
          merma_ml: mermaMl,
          closed_by: closedBy,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string; details?: string[] };

      if (!response.ok || !result.ok) {
        console.warn("Could not close local barrel.", { error: result.error, details: result.details, barrelId: currentBarrel.dbId });
        return false;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
      return true;
    }

    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? { ...b, status: "closed", mermaMl, closedAt: new Date().toISOString(), closedBy }
          : b
      )
    );
    return true;
  }

  async function handleEdit(barrelId: number, fields: BarrelEditFields) {
    if (dataMode === "connected" && operationalContext) {
      const currentBarrel = barrels.find((barrel) => barrel.id === barrelId);
      if (!currentBarrel?.dbId) {
        console.warn("Could not edit local barrel because the persisted id is missing.", { barrelId });
        return false;
      }

      const response = await fetch("/api/ops/barrels", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          barrel_id: currentBarrel.dbId,
          brand: fields.brand,
          group_name: fields.group,
          beer_style: fields.beerStyle ?? null,
          abv: fields.abv ?? null,
          external_product_ids: fields.external_product_ids,
          volume_l: fields.volumeL,
          price_paid: fields.pricePaid,
          opened_by: fields.openedBy,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string };

      if (!response.ok || !result.ok) {
        console.warn("Could not edit local barrel.", { error: result.error, barrelId: currentBarrel.dbId });
        return false;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
      return true;
    }

    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? {
              ...b,
              ...fields,
              volumeL: fields.volumeL ?? b.volumeL,
              volumeMl:
                fields.volumeL !== undefined && fields.volumeL !== null
                  ? Math.round(fields.volumeL * 1000)
                  : b.volumeMl,
              pricePaid: fields.pricePaid ?? b.pricePaid,
              pricePaidCents:
                fields.pricePaid !== undefined && fields.pricePaid !== null
                  ? Math.round(fields.pricePaid * 100)
                  : fields.pricePaid === null
                    ? null
                    : b.pricePaidCents,
              editedAt: new Date().toISOString(),
              editedBy: currentEmployee,
            }
          : b
      )
    );
    return true;
  }

  async function handleMove(barrelId: number, destinationLineId: number, movedBy: string) {
    if (dataMode === "connected" && operationalContext) {
      const currentBarrel = barrels.find((barrel) => barrel.id === barrelId);
      if (!currentBarrel?.dbId) {
        console.warn("Could not move local barrel because the persisted id is missing.", { barrelId });
        return false;
      }

      const response = await fetch("/api/ops/barrels", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "move",
          merchant_id: operationalContext.merchantId,
          pos_provider: operationalContext.posProvider,
          barrel_id: currentBarrel.dbId,
          destination_line_id: destinationLineId,
          moved_by: movedBy,
        }),
      });
      const result = (await response.json()) as OperationalStatusResponse & { error?: string };

      if (!response.ok || !result.ok) {
        console.warn("Could not move local barrel.", { error: result.error, barrelId: currentBarrel.dbId, destinationLineId });
        return false;
      }

      setLines((result.snapshot?.lines ?? []).map(lineFromOperational));
      setBarrels((result.snapshot?.barrels ?? []).map(barrelFromOperational));
      setProducts((result.snapshot?.mappingProducts ?? []).map(productFromOperational));
      setOperationalContext(result.snapshot?.context ?? operationalContext);
      setSelectedLineId(destinationLineId);
      return true;
    }

    const destinationOccupied = barrels.some(
      (barrel) => barrel.status === "active" && barrel.lineId === destinationLineId && barrel.id !== barrelId
    );

    if (destinationOccupied) return false;

    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? {
              ...b,
              lineId: destinationLineId,
              editedAt: new Date().toISOString(),
              editedBy: movedBy,
            }
          : b
      )
    );
    setSelectedLineId(destinationLineId);
    return true;
  }

  function handleVoid(barrelId: number) {
    setBarrels((bs) =>
      bs.map((b) => (b.id === barrelId ? { ...b, voided: !b.voided } : b))
    );
  }

  function handleMapLocalBarrel(barrelId: number, externalProductIds: string[]) {
    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? { ...b, external_product_ids: externalProductIds, editedAt: new Date().toISOString(), editedBy: currentEmployee }
          : b
      )
    );
  }

  function handleSetLocalProductCupMl(externalProductId: string, cupMl: number) {
    setProducts((items) =>
      items.map((product) =>
        product.external_product_id === externalProductId
          ? { ...product, cupMl, cup_ml: cupMl }
          : product
      )
    );
  }

  function handleSaveTemplate(
    data: {
      brand: string;
      group: string;
      beerStyle?: string;
      external_product_ids: string[];
      volumeL: number;
      lastPrice: number;
    },
    editId: number | null
  ) {
    if (editId) {
      setTemplates((ts) => ts.map((t) => (t.id === editId ? { ...t, ...data } : t)));
    } else {
      const exists = templates.find(
        (t) => t.group === data.group && t.brand === data.brand
      );
      if (!exists) {
        setTemplates((ts) => [...ts, { id: Date.now(), ...data, pos_provider: "mock", timesUsed: 0 }]);
      }
    }
  }

  function handleDeleteTemplate(id: number) {
    setTemplates((ts) => ts.filter((t) => t.id !== id));
  }

  return (
    <div
      className={`${darkMode ? "dark" : ""} h-screen flex flex-col overflow-hidden`}
      style={{
        background: darkMode ? "#0f1117" : "#fff",
        color: darkMode ? "#e2e8f0" : "#111827",
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 h-[52px] shrink-0"
        style={{
          borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
          background: darkMode ? "#0f1117" : "#fff",
        }}
      >
        <div className="flex items-center gap-2.5">
          <PourLogo size={28} dark={darkMode} />
          <div>
            <div
              className="text-sm font-bold tracking-widest uppercase"
              style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
            >
              Pour
            </div>
            <div
              className="text-[9px] tracking-widest uppercase"
              style={{ color: darkMode ? "#2a3050" : "#d1d5db" }}
            >
              Keg Service Intelligence
            </div>
          </div>
        </div>

        {/* Main tabs */}
        <div
          className="flex gap-0.5 rounded-lg p-0.5"
          style={{
            background: darkMode ? "#151820" : "#f3f4f6",
          }}
        >
          {[
            { key: "dashboard" as const, label: "Dashboard" },
            { key: "board" as const, label: "Keg Board" },
            { key: "templates" as const, label: `Plantillas${templates.length > 0 ? ` (${templates.length})` : ""}` },
            { key: "history" as const, label: "Historial" },
            { key: "operations" as const, label: "POS" },
            { key: "config" as const, label: "Configuración" },
            { key: "menu" as const, label: "Menú" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-3.5 py-1.5 rounded-md text-xs transition-all whitespace-nowrap"
              style={{
                background: tab === t.key ? (darkMode ? "#242840" : "#fff") : "transparent",
                color: tab === t.key ? (darkMode ? "#e2e8f0" : "#111827") : darkMode ? "#475569" : "#6b7280",
                fontWeight: tab === t.key ? 600 : 400,
                boxShadow: tab === t.key ? "0 1px 3px #0000001a" : "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          className="text-[11px]"
          style={{ color: darkMode ? "#475569" : "#9ca3af" }}
        >
          {dataMode === "connected" ? "POS conectado" : dataMode === "demo" ? "Mock POS" : "POS sin estado"} ·{" "}
          <span
            className="font-medium"
            style={{ color: darkMode ? "#94a3b8" : "#374151" }}
          >
            {currentEmployee}
          </span>
        </div>
      </div>

      <DebugBadge darkMode={darkMode} />

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "dashboard" && (
          <DashboardTab
            barrels={barrels}
            lines={lines}
            barConfig={barConfig}
            darkMode={darkMode}
          />
        )}

        {tab === "board" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Board stats */}
            <div
              className="flex justify-between items-center px-5 py-3"
              style={{
                borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                background: darkMode ? "#0f1117" : "#fff",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="text-sm"
                  style={{ color: darkMode ? "#94a3b8" : "#6b7280" }}
                >
                  <span
                    className="font-semibold"
                    style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                  >
                    {lines.length}
                  </span>{" "}
                  líneas
                </div>
                {/* Board view toggle */}
                <div
                  className="flex gap-0.5 rounded-lg p-0.5"
                  style={{ background: darkMode ? "#1c2030" : "#f3f4f6" }}
                >
                  {[
                    { k: "grid" as const, icon: "⊞" },
                    { k: "list" as const, icon: "☰" },
                  ].map((v) => (
                    <button
                      key={v.k}
                      onClick={() => setBoardView(v.k)}
                      className="px-2 py-1 rounded text-sm"
                      style={{
                        background:
                          boardView === v.k
                            ? darkMode
                              ? "#242840"
                              : "#fff"
                            : "transparent",
                        color:
                          boardView === v.k
                            ? darkMode
                              ? "#e2e8f0"
                              : "#111827"
                            : darkMode
                            ? "#475569"
                            : "#9ca3af",
                        fontWeight: boardView === v.k ? 600 : 400,
                      }}
                    >
                      {v.icon}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                {[
                  { count: activeCount, label: "Activas", bg: "#f0fdf4", border: "#bbf7d0", color: "#16a34a" },
                  ...(lowCount > 0
                    ? [{ count: lowCount, label: "Bajas", bg: "#fffbeb", border: "#fde68a", color: "#d97706" }]
                    : []),
                  { count: reserveBarrels.length, label: "Reserva", bg: "#eff6ff", border: "#bfdbfe", color: "#2563eb" },
                  { count: emptyCount, label: "Libres", bg: "#f9fafb", border: "#e5e7eb", color: "#9ca3af" },
                ].map(({ count, label, bg, border, color }) => (
                  <div
                    key={label}
                    className="text-center px-3 py-1 rounded-md"
                    style={{
                      background: bg,
                      border: `1px solid ${border}`,
                    }}
                  >
                    <div
                      className="font-mono text-sm font-bold"
                      style={{ color }}
                    >
                      {count}
                    </div>
                    <div className="text-[9px] tracking-wide uppercase text-muted-foreground">
                      {label}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => setReserveFormOpen((value) => !value)}
                  className="px-3 py-2 rounded-md text-xs font-semibold"
                  style={{
                    background: "linear-gradient(135deg,#9f1239,#f43f5e)",
                    color: "#fff",
                  }}
                >
                  + Reserva
                </button>
              </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Grid */}
              <div
                className="flex-1 p-3.5 overflow-y-auto"
                style={{ background: darkMode ? "#0c0f18" : "#f9fafb" }}
              >
                {boardView === "grid" ? (
                  <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))" }}>
                    {lines.map((line) => (
                      <LineCard
                        key={line.id}
                        line={line}
                        barrel={getBarrel(line.id)}
                        isSelected={selectedLineId === line.id}
                        onClick={() => setSelectedLineId(line.id)}
                        darkMode={darkMode}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {lines.map((line) => {
                      const b = getBarrel(line.id);
                      const isEmpty = !b;
                      const totalMl = b ? b.volumeL * 1000 : 0;
                      const rPct = b ? remPct(b.mlConsumed, totalMl) : 0;
                      const consumed = b ? parseFloat(yPct(b.mlConsumed, totalMl)) : 0;
                      const color = b ? yColor(consumed) : "#9ca3af";
                      return (
                        <div
                          key={line.id}
                          onClick={() => setSelectedLineId(line.id)}
                          className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg cursor-pointer transition-all"
                          style={{
                            background:
                              selectedLineId === line.id
                                ? darkMode
                                  ? "#1c2030"
                                  : "#fff"
                                : darkMode
                                ? "#151820"
                                : "#fff",
                            border: `1.5px solid ${
                              selectedLineId === line.id
                                ? "#f43f5e"
                                : darkMode
                                ? "#2a3050"
                                : "#e5e7eb"
                            }`,
                          }}
                        >
                          <div
                            className="font-mono text-xs font-semibold w-7 shrink-0"
                            style={{
                              color:
                                selectedLineId === line.id
                                  ? "#f43f5e"
                                  : darkMode
                                  ? "#475569"
                                  : "#9ca3af",
                            }}
                          >
                            {String(line.id).padStart(2, "0")}
                          </div>
                          {line.note && (
                            <div className="text-[9px] tracking-wide uppercase text-purple-400 bg-purple-500/10 rounded px-1.5 py-0.5 shrink-0">
                              {line.note}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            {isEmpty ? (
                              <span
                                className="text-xs"
                                style={{ color: darkMode ? "#2a3050" : "#d1d5db" }}
                              >
                                Vacía
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap"
                                  style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                                >
                                  {b.group}
                                </span>
                                {b.brand && (
                                  <span
                                    className="text-[11px]"
                                    style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                                  >
                                    {b.brand}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {!isEmpty && (
                            <div className="flex items-center gap-2 shrink-0">
                              <div
                                className="w-20 h-1 rounded-sm overflow-hidden"
                                style={{
                                  background: darkMode ? "#2a3050" : "#e5e7eb",
                                }}
                              >
                                <div
                                  className="h-full rounded-sm"
                                  style={{ width: `${rPct}%`, background: color }}
                                />
                              </div>
                              <span
                                className="font-mono text-xs font-bold w-9 text-right"
                                style={{ color }}
                              >
                                {Math.round(rPct)}%
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div
                        className="text-sm font-semibold"
                        style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                      >
                        Barriles de reserva
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Preparados, sin línea asignada
                      </div>
                    </div>
                    {!reserveFormOpen && (
                      <button
                        onClick={() => setReserveFormOpen(true)}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold"
                        style={{
                          background: darkMode ? "#151820" : "#fff",
                          border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                          color: darkMode ? "#94a3b8" : "#374151",
                        }}
                      >
                        + Crear reserva
                      </button>
                    )}
                  </div>

                  {reserveFormOpen && (
                    <div
                      className="rounded-lg p-3 mb-3"
                      style={{
                        background: darkMode ? "#151820" : "#fff",
                        border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                      }}
                    >
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <input
                          value={reserveForm.brand}
                          onChange={(event) => setReserveForm((form) => ({ ...form, brand: event.target.value }))}
                          placeholder="Cervecería"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                        <input
                          value={reserveForm.group}
                          onChange={(event) => setReserveForm((form) => ({ ...form, group: event.target.value }))}
                          placeholder="Nombre de cerveza"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                        <input
                          value={reserveForm.beerStyle}
                          onChange={(event) => setReserveForm((form) => ({ ...form, beerStyle: event.target.value }))}
                          placeholder="Estilo"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                        <input
                          value={reserveForm.abv}
                          onChange={(event) => setReserveForm((form) => ({ ...form, abv: event.target.value }))}
                          placeholder="ABV"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                        <input
                          value={reserveForm.volumeL}
                          onChange={(event) => setReserveForm((form) => ({ ...form, volumeL: event.target.value }))}
                          placeholder="Volumen L"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                        <input
                          value={reserveForm.pricePaid}
                          onChange={(event) => setReserveForm((form) => ({ ...form, pricePaid: event.target.value }))}
                          placeholder="Costo barril"
                          className="rounded-md px-3 py-2 text-xs"
                          style={{ border: "1px solid #e5e7eb" }}
                        />
                      </div>
                      <ProductSelector
                        products={products}
                        selected={reserveForm.external_product_ids}
                        onChange={(externalProductIds) =>
                          setReserveForm((form) => ({ ...form, external_product_ids: externalProductIds }))
                        }
                        darkMode={darkMode}
                      />
                      <input
                        value={reserveForm.notes}
                        onChange={(event) => setReserveForm((form) => ({ ...form, notes: event.target.value }))}
                        placeholder="Notas"
                        className="rounded-md px-3 py-2 text-xs mt-2 w-full"
                        style={{ border: "1px solid #e5e7eb" }}
                      />
                      {reserveErrors.create && (
                        <div className="text-xs text-red-600 mt-2">{reserveErrors.create}</div>
                      )}
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={() => setReserveFormOpen(false)}
                          className="px-3 py-2 rounded-md text-xs"
                          style={{
                            border: `1px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                            color: darkMode ? "#94a3b8" : "#6b7280",
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => void handleCreateReserve()}
                          className="px-3 py-2 rounded-md text-xs font-semibold text-white"
                          style={{ background: "linear-gradient(135deg,#9f1239,#f43f5e)" }}
                        >
                          Guardar reserva
                        </button>
                      </div>
                    </div>
                  )}

                  {reserveBarrels.length === 0 ? (
                    <div
                      className="rounded-lg px-3 py-4 text-xs text-center"
                      style={{
                        background: darkMode ? "#151820" : "#fff",
                        border: `1.5px dashed ${darkMode ? "#2a3050" : "#d1d5db"}`,
                        color: darkMode ? "#475569" : "#9ca3af",
                      }}
                    >
                      No hay barriles de reserva.
                    </div>
                  ) : (
                    <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
                      {reserveBarrels.map((reserve) => {
                        const selectedDestination = reserveActivateLineById[reserve.id] ?? null;
                        const linkedProducts = products.filter((product) =>
                          reserve.external_product_ids.includes(product.external_product_id)
                        );

                        return (
                          <div
                            key={reserve.id}
                            className="rounded-lg p-3"
                            style={{
                              background: darkMode ? "#151820" : "#fff",
                              border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="text-[10px] uppercase tracking-wide text-blue-500 font-semibold">
                                  Reserva
                                </div>
                                <div
                                  className="text-sm font-bold overflow-hidden text-ellipsis whitespace-nowrap"
                                  style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                                >
                                  {reserve.group || "Barril sin nombre"}
                                </div>
                                {reserve.brand && (
                                  <div className="text-[11px] text-muted-foreground">{reserve.brand}</div>
                                )}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {reserve.volumeMl ? `${reserve.volumeMl / 1000}L` : "Vol. n/r"}
                              </div>
                            </div>
                            {reserveEditId === reserve.id ? (
                              <div className="mt-3">
                                <div className="grid grid-cols-2 gap-2 mb-2">
                                  <input
                                    value={reserveEditForm.brand}
                                    onChange={(event) => setReserveEditForm((form) => ({ ...form, brand: event.target.value }))}
                                    placeholder="Cervecería"
                                    className="rounded-md px-2 py-1.5 text-xs"
                                    style={{ border: "1px solid #e5e7eb" }}
                                  />
                                  <input
                                    value={reserveEditForm.group}
                                    onChange={(event) => setReserveEditForm((form) => ({ ...form, group: event.target.value }))}
                                    placeholder="Cerveza"
                                    className="rounded-md px-2 py-1.5 text-xs"
                                    style={{ border: "1px solid #e5e7eb" }}
                                  />
                                  <input
                                    value={reserveEditForm.volumeL}
                                    onChange={(event) => setReserveEditForm((form) => ({ ...form, volumeL: event.target.value }))}
                                    placeholder="Volumen L"
                                    className="rounded-md px-2 py-1.5 text-xs"
                                    style={{ border: "1px solid #e5e7eb" }}
                                  />
                                  <input
                                    value={reserveEditForm.pricePaid}
                                    onChange={(event) => setReserveEditForm((form) => ({ ...form, pricePaid: event.target.value }))}
                                    placeholder="Costo"
                                    className="rounded-md px-2 py-1.5 text-xs"
                                    style={{ border: "1px solid #e5e7eb" }}
                                  />
                                </div>
                                <ProductSelector
                                  products={products}
                                  selected={reserveEditForm.external_product_ids}
                                  onChange={(externalProductIds) =>
                                    setReserveEditForm((form) => ({ ...form, external_product_ids: externalProductIds }))
                                  }
                                  darkMode={darkMode}
                                />
                                <div className="flex justify-end gap-2 mt-2">
                                  <button
                                    onClick={() => setReserveEditId(null)}
                                    className="px-2.5 py-1.5 rounded-md text-xs"
                                    style={{ border: "1px solid #e5e7eb", color: "#6b7280" }}
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    onClick={() => void handleSaveReserveEdit(reserve.id)}
                                    className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-white"
                                    style={{ background: "#111827" }}
                                  >
                                    Guardar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => startReserveEdit(reserve)}
                                className="mt-2 text-[11px] font-medium"
                                style={{ color: "#f43f5e" }}
                              >
                                Editar reserva
                              </button>
                            )}
                            <div className="flex flex-wrap gap-1 mt-2">
                              {linkedProducts.length === 0 ? (
                                <span className="text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-0.5">
                                  Sin producto vinculado
                                </span>
                              ) : (
                                linkedProducts.slice(0, 3).map((product) => (
                                  <span
                                    key={product.external_product_id}
                                    className="text-[11px] bg-muted rounded px-2 py-0.5"
                                  >
                                    {product.variant} · {product.cupMl || 0}ml
                                  </span>
                                ))
                              )}
                            </div>
                            <div className="flex gap-2 mt-3">
                              <select
                                value={selectedDestination ?? ""}
                                onChange={(event) =>
                                  setReserveActivateLineById((items) => ({
                                    ...items,
                                    [reserve.id]: event.target.value ? Number(event.target.value) : null,
                                  }))
                                }
                                className="flex-1 rounded-md px-2 py-2 text-xs"
                                style={{ border: "1px solid #e5e7eb" }}
                              >
                                <option value="">Línea destino</option>
                                {emptyLines.map((line) => (
                                  <option key={line.id} value={line.id}>
                                    Línea {String(line.id).padStart(2, "0")}
                                  </option>
                                ))}
                              </select>
                              <button
                                disabled={!selectedDestination}
                                onClick={() =>
                                  selectedDestination
                                    ? void handleActivateReserve(reserve.id, selectedDestination)
                                    : undefined
                                }
                                className="px-3 py-2 rounded-md text-xs font-semibold"
                                style={{
                                  background: selectedDestination ? "#111827" : "#f3f4f6",
                                  color: selectedDestination ? "#fff" : "#9ca3af",
                                }}
                              >
                                Activar
                              </button>
                            </div>
                            {reserveErrors[reserve.id] && (
                              <div className="text-xs text-red-600 mt-2">{reserveErrors[reserve.id]}</div>
                            )}
                            {(reserve.volumeMl === 0 || reserve.pricePaidCents === null) && (
                              <div className="text-[11px] text-amber-600 mt-2">
                                Volumen o costo no registrado.
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Detail */}
              {selectedLineId && selectedLine && (
                <div
                  className="w-[300px] shrink-0 overflow-y-auto"
                  style={{
                    borderLeft: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                    background: darkMode ? "#0f1117" : "#fff",
                  }}
                >
                  <DetailPanel
                    key={selectedLineId}
                    line={selectedLine}
                    barrel={selectedBarrel}
                    products={products}
                    templates={templates}
                    currentEmployee={currentEmployee}
                    onOpen={handleOpen}
                    onClose={handleClose}
                    onEdit={handleEdit}
                    onMove={handleMove}
                    onDeselect={() => setSelectedLineId(null)}
                    onSaveTemplate={handleSaveTemplate}
                    barConfig={barConfig}
                    allBarrels={barrels}
                    lines={lines}
                    darkMode={darkMode}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "templates" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-5 py-4"
              style={{
                borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                background: darkMode ? "#0f1117" : "#fff",
              }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                  >
                    Plantillas de Barriles
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Configura barriles frecuentes para abrirlos en segundos
                  </div>
                </div>
                <button
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#9f1239,#f43f5e)" }}
                >
                  + Nueva plantilla
                </button>
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4"
              style={{ background: darkMode ? "#0c0f18" : "#f9fafb" }}
            >
              {templates.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <div className="text-4xl mb-4">📋</div>
                  <div className="text-sm">No hay plantillas guardadas todavía</div>
                  <div className="text-xs mt-1">Crea una desde el Keg Board al abrir un barril</div>
                </div>
              ) : (
                <div className="grid gap-3 max-w-2xl mx-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl p-4"
                      style={{
                        background: darkMode ? "#151820" : "#fff",
                        border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          {t.brand && (
                            <div className="text-[11px] text-muted-foreground">{t.brand}</div>
                          )}
                          <div
                            className="text-[15px] font-bold"
                            style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                          >
                            {t.group}
                          </div>
                          <div className="flex gap-3 mt-1">
                            <span className="text-[11px] text-muted-foreground">{t.volumeL}L default</span>
                            {t.lastPrice > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                Último: ${t.lastPrice.toLocaleString()}
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              Usado {t.timesUsed}x
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            className="px-2.5 py-1 rounded text-[11px]"
                            style={{
                              background: "#f9fafb",
                              border: "1px solid #e5e7eb",
                              color: "#6b7280",
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDeleteTemplate(t.id)}
                            className="px-2.5 py-1 rounded text-[11px]"
                            style={{
                              background: "#fff",
                              border: "1px solid #fecaca",
                              color: "#dc2626",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {products.filter((p) => t.external_product_ids.includes(p.external_product_id)).map((p) => (
                          <div
                            key={p.id}
                            className="text-[11px] rounded px-2 py-0.5"
                            style={{
                              background: "#f3f4f6",
                              border: "1px solid #e5e7eb",
                              color: "#6b7280",
                            }}
                          >
                            {p.variant} · {p.cupMl}ml
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-5 py-4"
              style={{
                borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                background: darkMode ? "#0f1117" : "#fff",
              }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
              >
                Historial de Barriles
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {barrels.filter((b) => b.status === "closed").length} barriles cerrados
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-4"
              style={{ background: darkMode ? "#0c0f18" : "#f9fafb" }}
            >
              {barrels
                .filter((b) => b.status === "closed")
                .sort((a, b) => new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime())
                .map((b) => {
                  const totalMl = b.volumeL * 1000;
                  const bYield = parseFloat(yPct(b.mlConsumed, totalMl));
                  const bColor = yColor(bYield);
                  const mermaPct = (b.mermaMl / totalMl) * 100;
                  const mermaOk = mermaPct <= barConfig.maxMermaPct;
                  const historyWarnings = closedBarrelHistoryWarnings({
                    status: b.status,
                    volumeMl: totalMl,
                    mlConsumed: b.mlConsumed,
                    mermaMl: b.mermaMl,
                    closedAt: b.closedAt,
                    closedBy: b.closedBy,
                    grossRevenueCents: b.revenueBrutoCents ?? 0,
                    discountRevenueCents: b.revenueDescuentosCents ?? 0,
                    netRevenueCents: b.revenueNetoCents ?? 0,
                  });
                  return (
                    <div
                      key={b.id}
                      className="rounded-xl p-4 mb-2.5"
                      style={{
                        background: darkMode ? "#151820" : "#fff",
                        border: `1.5px solid ${
                          b.voided
                            ? darkMode
                              ? "#1c2030"
                              : "#e5e7eb"
                            : mermaOk
                            ? darkMode
                              ? "#2a3050"
                              : "#e5e7eb"
                            : "#fecaca"
                        }`,
                        opacity: b.voided ? 0.5 : 1,
                      }}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {b.kegId || `KEG-${b.id}`}
                          </div>
                          {b.voided && (
                            <div className="text-[9px] tracking-wide uppercase text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                              ANULADO
                            </div>
                          )}
                          {historyWarnings.length > 0 && (
                            <div className="text-[9px] tracking-wide uppercase text-amber-600 bg-amber-50 rounded px-1.5 py-0.5">
                              Revisar datos
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-[10px] text-muted-foreground">
                            Línea {String(b.lineId).padStart(2, "0")}
                          </div>
                          <button
                            onClick={() => handleVoid(b.id)}
                            className="text-[10px] px-2 py-0.5 rounded"
                            style={{
                              border: `1px solid ${b.voided ? "#bbf7d0" : "#e5e7eb"}`,
                              color: b.voided ? "#16a34a" : "#9ca3af",
                            }}
                          >
                            {b.voided ? "Restaurar" : "Anular"}
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          {b.brand && (
                            <div className="text-[10px] text-muted-foreground">
                              {b.brand}
                              {b.beerStyle ? ` · ${b.beerStyle}` : ""}
                            </div>
                          )}
                          <div
                            className="text-[15px] font-bold"
                            style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                          >
                            {b.group}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(b.openedAt ?? b.closedAt ?? Date.now()).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                            })}{" "}
                            →{" "}
                            {new Date(b.closedAt!).toLocaleDateString("es-MX", {
                              day: "2-digit",
                              month: "short",
                            })}{" "}
                            · {b.openedBy}
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <div
                            className="font-mono text-xl font-bold"
                            style={{ color: bColor }}
                          >
                            {bYield}%
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {b.volumeL}L · {(b.mlConsumed / 1000).toFixed(1)}L vendidos
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <div className="bg-muted rounded px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground">Merma: </span>
                          <span className="font-mono font-semibold">
                            {(b.mermaMl / 1000).toFixed(1)}L ({mermaPct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="bg-muted rounded px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground">Precio: </span>
                          <span className="font-mono font-semibold">
                            ${b.pricePaid.toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-muted rounded px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground">Bruto: </span>
                          <span className="font-mono font-semibold">
                            ${Math.round((b.revenueBrutoCents || 0) / 100).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-muted rounded px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground">Desc: </span>
                          <span className="font-mono font-semibold">
                            ${Math.round((b.revenueDescuentosCents || 0) / 100).toLocaleString()}
                          </span>
                        </div>
                        <div className="bg-muted rounded px-2 py-1 text-[11px]">
                          <span className="text-muted-foreground">Neto: </span>
                          <span className="font-mono font-semibold">
                            ${Math.round((b.revenueNetoCents || 0) / 100).toLocaleString()}
                          </span>
                        </div>
                        {mermaOk ? (
                          <div className="bg-green-50 rounded px-2 py-1 text-[11px] flex items-center gap-1">
                            <span>✅</span>
                            <span className="text-green-600 font-medium">Merma OK</span>
                          </div>
                        ) : (
                          <div className="bg-red-50 rounded px-2 py-1 text-[11px] flex items-center gap-1">
                            <span>⚠️</span>
                            <span className="text-red-600 font-mono font-semibold">
                              −$
                              {Math.round(
                                Math.max(
                                  0,
                                  b.mermaMl - (barConfig.maxMermaPct / 100) * totalMl
                                ) * barConfig.pricePerMl
                              ).toLocaleString()}{" "}
                              MXN
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {tab === "operations" && (
          <OperationsTab
            barrels={barrels}
            products={products}
            darkMode={darkMode}
            onMapLocalBarrel={handleMapLocalBarrel}
            onSetLocalProductCupMl={handleSetLocalProductCupMl}
          />
        )}

        {tab === "config" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              className="px-5 py-4"
              style={{
                borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                background: darkMode ? "#0f1117" : "#fff",
              }}
            >
              <div
                className="text-sm font-semibold"
                style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
              >
                Configuración
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Ajustes del sistema de control de barriles
              </div>
            </div>
            <div
              className="flex-1 overflow-y-auto p-6"
              style={{ background: darkMode ? "#0c0f18" : "#f9fafb" }}
            >
              <div className="max-w-md mx-auto space-y-6">
                {/* Dark mode toggle */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: darkMode ? "#151820" : "#fff",
                    border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm font-semibold" style={{ color: darkMode ? "#e2e8f0" : "#111827" }}>
                        Modo Oscuro
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Reduce la fatiga visual en ambientes con poca luz
                      </div>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="w-12 h-6 rounded-full relative transition-colors"
                      style={{ background: darkMode ? "#f43f5e" : "#e5e7eb" }}
                    >
                      <div
                        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                        style={{ left: darkMode ? 26 : 4 }}
                      />
                    </button>
                  </div>
                </div>

                {/* Merma config */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: darkMode ? "#151820" : "#fff",
                    border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                  }}
                >
                  <div className="text-sm font-semibold mb-4" style={{ color: darkMode ? "#e2e8f0" : "#111827" }}>
                    Control de Merma
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                        Umbral máximo de merma (%)
                      </label>
                      <input
                        type="number"
                        value={barConfig.maxMermaPct}
                        onChange={(e) =>
                          setBarConfig((c) => ({ ...c, maxMermaPct: parseFloat(e.target.value) || 8 }))
                        }
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{
                          background: darkMode ? "#0f1117" : "#f9fafb",
                          border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                          color: darkMode ? "#e2e8f0" : "#111827",
                        }}
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Barriles con merma superior a este % se marcarán con alerta
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1.5">
                        Costo por ml de exceso ($MXN)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={barConfig.pricePerMl}
                        onChange={(e) =>
                          setBarConfig((c) => ({ ...c, pricePerMl: parseFloat(e.target.value) || 0.2 }))
                        }
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{
                          background: darkMode ? "#0f1117" : "#f9fafb",
                          border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                          color: darkMode ? "#e2e8f0" : "#111827",
                        }}
                      />
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Usado para calcular pérdidas por exceso de merma
                      </div>
                    </div>
                  </div>
                </div>

                {/* Lines config */}
                <div
                  className="rounded-xl p-4"
                  style={{
                    background: darkMode ? "#151820" : "#fff",
                    border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                  }}
                >
                  <div className="text-sm font-semibold mb-4" style={{ color: darkMode ? "#e2e8f0" : "#111827" }}>
                    Líneas de Servicio
                  </div>
                  <div className="space-y-2">
                    {lines.map((l) => (
                      <div key={l.id} className="flex items-center gap-3">
                        <div
                          className="font-mono text-xs font-semibold w-8"
                          style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                        >
                          {String(l.id).padStart(2, "0")}
                        </div>
                        <input
                          value={l.note}
                          onChange={(e) =>
                            setLines((ls) =>
                              ls.map((line) =>
                                line.id === l.id ? { ...line, note: e.target.value } : line
                              )
                            )
                          }
                          placeholder="Nota (ej. Nitro)"
                          className="flex-1 px-3 py-1.5 rounded-lg text-sm"
                          style={{
                            background: darkMode ? "#0f1117" : "#f9fafb",
                            border: `1px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                            color: darkMode ? "#e2e8f0" : "#111827",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "menu" && (
          <div className="flex-1 flex items-center justify-center" style={{ background: darkMode ? "#0c0f18" : "#f9fafb" }}>
            <div className="text-center">
              <div className="text-5xl mb-4">📺</div>
              <div className="text-sm font-semibold" style={{ color: darkMode ? "#e2e8f0" : "#111827" }}>
                Generador de Menú
              </div>
              <div className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Crea menús personalizados para TV o impresión basados en tus barriles activos
              </div>
              <div className="mt-4 text-xs text-primary">Próximamente</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
