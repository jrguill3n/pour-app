"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Link, RefreshCcw, Save, Unplug } from "lucide-react";
import type { Barrel, Product } from "@/lib/core/types";

interface OperationalAccount {
  id: string;
  merchantId: string;
  posProvider: string;
  posAccountId: string;
  connected: boolean;
  updatedAt: string;
}

interface OperationalProduct {
  id: string;
  externalProductId: string;
  name: string;
  cupMl: number | null;
  priceCents: number | null;
}

interface OperationalBarrel {
  id: string;
  lineId: number;
  kegId: string | null;
  brand: string | null;
  groupName: string | null;
  externalProductIds: string[];
  volumeMl: number;
  mlConsumed: number;
  mermaMl: number;
  revenueBrutoCents: number;
  revenueDescuentosCents: number;
  revenueNetoCents: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
}

interface OperationalPollingLog {
  id: string;
  dataType: string;
  lastPolledAt: string | null;
  lastSyncedAt: string | null;
  raw: unknown;
  updatedAt: string;
}

interface OperationalSnapshot {
  context: {
    merchantId: string;
    posProvider: string;
  };
  mode: "demo" | "connected";
  accounts: OperationalAccount[];
  products: OperationalProduct[];
  barrels: OperationalBarrel[];
  logs: OperationalPollingLog[];
}

interface OperationsTabProps {
  barrels: Barrel[];
  products: Product[];
  darkMode: boolean;
  onMapLocalBarrel: (barrelId: number, externalProductIds: string[]) => void;
  onSetLocalProductCupMl: (externalProductId: string, cupMl: number) => void;
}

const cardBase = "rounded-xl p-4";
const smallLabel = "text-[10px] tracking-wide uppercase text-muted-foreground";

function fmtDate(value: string | null | undefined) {
  if (!value) return "Pendiente";
  return new Date(value).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString("es-MX", {
    maximumFractionDigits: 0,
  })}`;
}

function rawSummary(raw: unknown) {
  if (!raw || typeof raw !== "object") return "";
  const value = raw as Record<string, unknown>;
  const count =
    value.transactions_processed ??
    value.transactions ??
    value.products ??
    value.locations ??
    value.employees;
  const status = value.status ? String(value.status) : "completed";
  return count === undefined ? status : `${status} · ${String(count)} procesados`;
}

function productName(products: Array<Product | OperationalProduct>, externalProductId: string) {
  return (
    products.find((product) =>
      "external_product_id" in product
        ? product.external_product_id === externalProductId
        : product.externalProductId === externalProductId
    )?.name ?? externalProductId
  );
}

export function OperationsTab({
  barrels,
  products,
  darkMode,
  onMapLocalBarrel,
  onSetLocalProductCupMl,
}: OperationsTabProps) {
  const [snapshot, setSnapshot] = useState<OperationalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingBarrelId, setSavingBarrelId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string[]>>({});
  const [cupDrafts, setCupDrafts] = useState<Record<string, string>>({});

  const border = darkMode ? "#2a3050" : "#e5e7eb";
  const surface = darkMode ? "#151820" : "#fff";
  const pageBg = darkMode ? "#0c0f18" : "#f9fafb";
  const text = darkMode ? "#e2e8f0" : "#111827";
  const muted = darkMode ? "#94a3b8" : "#6b7280";

  async function loadStatus() {
    setLoading(true);
    const response = await fetch("/api/ops/status", { cache: "no-store" });
    const data = (await response.json()) as { ok: boolean; snapshot?: OperationalSnapshot };
    if (data.snapshot) {
      setSnapshot(data.snapshot);
      setMappingDrafts((drafts) => {
        const next = { ...drafts };
        for (const barrel of data.snapshot?.barrels ?? []) {
          next[barrel.id] = next[barrel.id] ?? barrel.externalProductIds;
        }
        return next;
      });
      setCupDrafts((drafts) => {
        const next = { ...drafts };
        for (const product of data.snapshot?.products ?? []) {
          if (product.cupMl) next[product.externalProductId] = String(product.cupMl);
        }
        return next;
      });
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadStatus().catch((error) => {
      setMessage(error instanceof Error ? error.message : "No se pudo cargar el estado.");
      setLoading(false);
    });
  }, []);

  const account = snapshot?.accounts.find((item) => item.posProvider !== "mock") ?? snapshot?.accounts[0] ?? null;
  const lastSync = snapshot?.logs.find((log) => log.lastSyncedAt)?.lastSyncedAt ?? null;
  const dbProducts = snapshot?.products ?? [];
  const usableProducts =
    dbProducts.length > 0
      ? dbProducts
      : products.map((product) => ({
          id: String(product.id),
          externalProductId: product.external_product_id,
          name: product.name,
          cupMl: product.cupMl,
          priceCents: product.price_cents ?? null,
        }));
  const dbBarrels = snapshot?.barrels ?? [];
  const usableBarrels =
    dbBarrels.length > 0
      ? dbBarrels
      : barrels.map((barrel) => ({
          id: String(barrel.id),
          lineId: barrel.lineId,
          kegId: barrel.kegId,
          brand: barrel.brand,
          groupName: barrel.group,
          externalProductIds: barrel.external_product_ids,
          volumeMl: barrel.volumeL * 1000,
          mlConsumed: barrel.mlConsumed,
          mermaMl: barrel.mermaMl,
          revenueBrutoCents: barrel.revenueBrutoCents ?? 0,
          revenueDescuentosCents: barrel.revenueDescuentosCents ?? 0,
          revenueNetoCents: barrel.revenueNetoCents ?? 0,
          status: barrel.status,
          openedAt: barrel.openedAt,
          closedAt: barrel.closedAt,
        }));
  const activeBarrels = usableBarrels.filter((barrel) => barrel.status === "active");
  const historyBarrels = usableBarrels.filter((barrel) => barrel.status === "closed");
  const unmappedActive = activeBarrels.filter((barrel) => barrel.externalProductIds.length === 0).length;
  const productsMissingCup = usableProducts.filter((product) => !product.cupMl).length;

  const onboarding = useMemo(
    () => [
      { label: "Conectar POS", done: Boolean(account?.connected || snapshot?.mode === "demo") },
      { label: "Sincronizar productos", done: usableProducts.length > 0 },
      { label: "Crear primer barril", done: usableBarrels.length > 0 },
      { label: "Mapear productos", done: activeBarrels.length > 0 && unmappedActive === 0 },
      { label: "Ver consumo", done: activeBarrels.some((barrel) => barrel.mlConsumed > 0) },
    ],
    [account?.connected, activeBarrels, snapshot?.mode, unmappedActive, usableBarrels.length, usableProducts.length]
  );

  async function runSync() {
    setSyncing(true);
    setMessage("Sync iniciado. Esta accion es idempotente.");
    const response = await fetch("/api/ops/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: snapshot?.context.posProvider,
        pos_account_id: account?.posAccountId,
      }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      snapshot?: OperationalSnapshot;
    };
    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "El sync fallo.");
    } else {
      setSnapshot(data.snapshot ?? null);
      setMessage("Sync completado. Los barriles activos fueron recalculados.");
    }
    setSyncing(false);
  }

  async function saveMapping(barrelId: string) {
    const externalProductIds = mappingDrafts[barrelId] ?? [];
    setSavingBarrelId(barrelId);
    const cup_ml_by_external_product_id = Object.fromEntries(
      Object.entries(cupDrafts)
        .map(([externalProductId, value]) => [externalProductId, Number(value)] as const)
        .filter(([, value]) => Number.isFinite(value) && value > 0)
    );

    const response = await fetch("/api/ops/mappings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        merchant_id: snapshot?.context.merchantId,
        pos_provider: snapshot?.context.posProvider,
        barrel_id: barrelId,
        external_product_ids: externalProductIds,
        cup_ml_by_external_product_id,
      }),
    });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      snapshot?: OperationalSnapshot;
    };

    if (!response.ok || !data.ok) {
      setMessage(data.error ?? "No se pudo guardar el mapeo.");
    } else {
      const numericBarrelId = Number(barrelId);
      if (Number.isFinite(numericBarrelId)) {
        onMapLocalBarrel(numericBarrelId, externalProductIds);
      }
      for (const [externalProductId, value] of Object.entries(cup_ml_by_external_product_id)) {
        onSetLocalProductCupMl(externalProductId, value);
      }
      setSnapshot(data.snapshot ?? null);
      setMessage("Mapeo guardado.");
    }
    setSavingBarrelId(null);
  }

  function toggleProduct(barrelId: string, externalProductId: string) {
    setMappingDrafts((drafts) => {
      const current = drafts[barrelId] ?? [];
      return {
        ...drafts,
        [barrelId]: current.includes(externalProductId)
          ? current.filter((id) => id !== externalProductId)
          : [...current, externalProductId],
      };
    });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div
        className="px-5 py-4"
        style={{
          borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
          background: darkMode ? "#0f1117" : "#fff",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" style={{ color: text }}>
              Operacion POS
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Conexion, sync, mapeos y estado operativo
            </div>
          </div>
          <button
            onClick={() => void runSync()}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#9f1239,#f43f5e)" }}
          >
            <RefreshCcw size={14} className={syncing ? "animate-spin" : ""} />
            Sync manual
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4" style={{ background: pageBg }}>
        <div className="max-w-6xl mx-auto space-y-4">
          {message && (
            <div
              className="rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: darkMode ? "#1c2030" : "#fff", border: `1px solid ${border}`, color: muted }}
            >
              <AlertCircle size={14} />
              {message}
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-3">
            <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}` }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className={smallLabel}>Connect POS</div>
                  <div className="text-sm font-semibold mt-1" style={{ color: text }}>
                    {account ? `${account.posProvider.toUpperCase()} · ${account.posAccountId}` : "Sin conexion"}
                  </div>
                </div>
                {account?.connected || snapshot?.mode === "demo" ? (
                  <Check size={18} color="#16a34a" />
                ) : (
                  <Unplug size={18} color="#dc2626" />
                )}
              </div>
              <div className="mt-3 text-[11px]" style={{ color: muted }}>
                {snapshot?.mode === "demo"
                  ? "Demo activo sin Poster. La experiencia mock sigue disponible."
                  : account?.connected
                  ? "Cuenta POS conectada y lista para sync manual."
                  : "Conecta Poster para traer productos, empleados y transacciones."}
              </div>
              <a
                href="/api/auth/poster/start"
                className="mt-3 inline-flex items-center gap-2 text-xs font-semibold"
                style={{ color: "#f43f5e" }}
              >
                <Link size={13} />
                Conectar Poster
              </a>
            </div>

            <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}` }}>
              <div className={smallLabel}>Sync status</div>
              <div className="grid grid-cols-2 gap-2 mt-3">
                <div>
                  <div className="font-mono text-lg font-bold" style={{ color: text }}>
                    {usableProducts.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Productos</div>
                </div>
                <div>
                  <div className="font-mono text-lg font-bold" style={{ color: text }}>
                    {activeBarrels.length}
                  </div>
                  <div className="text-[10px] text-muted-foreground">Barriles activos</div>
                </div>
              </div>
              <div className="text-[11px] mt-3" style={{ color: muted }}>
                Ultimo sync: {fmtDate(lastSync)}
              </div>
            </div>

            <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}` }}>
              <div className={smallLabel}>Onboarding</div>
              <div className="space-y-2 mt-3">
                {onboarding.map((step) => (
                  <div key={step.label} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-4 h-4 rounded-full inline-flex items-center justify-center"
                      style={{ background: step.done ? "#dcfce7" : "#f3f4f6", color: step.done ? "#16a34a" : "#9ca3af" }}
                    >
                      {step.done ? <Check size={11} /> : ""}
                    </span>
                    <span style={{ color: step.done ? text : muted }}>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {(unmappedActive > 0 || productsMissingCup > 0 || !account?.connected) && (
            <div
              className="rounded-xl p-3 text-xs"
              style={{ background: darkMode ? "#1c2030" : "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c" }}
            >
              {unmappedActive > 0 && <div>{unmappedActive} barriles activos no tienen productos POS mapeados.</div>}
              {productsMissingCup > 0 && <div>{productsMissingCup} productos no tienen cup_ml configurado.</div>}
              {!account?.connected && snapshot?.mode !== "demo" && <div>POS desconectado: el sync manual esta deshabilitado.</div>}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <div className="space-y-3">
              <div className="text-xs font-semibold" style={{ color: text }}>
                Mapeo producto a barril
              </div>
              {loading ? (
                <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}`, color: muted }}>
                  Cargando estado operativo...
                </div>
              ) : activeBarrels.length === 0 ? (
                <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}`, color: muted }}>
                  No hay barriles activos. Crea el primero desde Keg Board y vuelve para mapear productos POS.
                </div>
              ) : (
                activeBarrels.map((barrel) => {
                  const draft = mappingDrafts[barrel.id] ?? barrel.externalProductIds;
                  return (
                    <div key={barrel.id} className={cardBase} style={{ background: surface, border: `1.5px solid ${border}` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-mono text-[10px] text-muted-foreground">
                            Linea {String(barrel.lineId).padStart(2, "0")} · {barrel.kegId ?? barrel.id}
                          </div>
                          <div className="text-sm font-bold mt-1" style={{ color: text }}>
                            {barrel.groupName ?? "Barril sin nombre"}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {(barrel.mlConsumed / 1000).toFixed(1)}L consumidos · {fmtMoney(barrel.revenueNetoCents)} neto
                          </div>
                        </div>
                        <button
                          onClick={() => void saveMapping(barrel.id)}
                          disabled={savingBarrelId === barrel.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold text-white disabled:opacity-60"
                          style={{ background: "#111827" }}
                        >
                          <Save size={13} />
                          Guardar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {usableProducts.map((product) => {
                          const selected = draft.includes(product.externalProductId);
                          return (
                            <button
                              key={product.externalProductId}
                              onClick={() => toggleProduct(barrel.id, product.externalProductId)}
                              className="rounded-md px-2 py-1 text-[11px]"
                              style={{
                                background: selected ? "#f43f5e" : darkMode ? "#0f1117" : "#f9fafb",
                                border: `1px solid ${selected ? "#f43f5e" : border}`,
                                color: selected ? "#fff" : muted,
                              }}
                            >
                              {product.name}
                            </button>
                          );
                        })}
                      </div>
                      {draft.length > 0 && (
                        <div className="mt-3 grid gap-2 md:grid-cols-3">
                          {draft.map((externalProductId) => (
                            <label key={externalProductId} className="text-[11px] text-muted-foreground">
                              {productName(usableProducts, externalProductId)}
                              <input
                                value={cupDrafts[externalProductId] ?? ""}
                                onChange={(event) =>
                                  setCupDrafts((drafts) => ({
                                    ...drafts,
                                    [externalProductId]: event.target.value,
                                  }))
                                }
                                placeholder="cup_ml"
                                type="number"
                                className="mt-1 w-full px-2 py-1.5 rounded-md text-xs"
                                style={{
                                  background: darkMode ? "#0f1117" : "#fff",
                                  border: `1px solid ${border}`,
                                  color: text,
                                }}
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="space-y-3">
              <div className="text-xs font-semibold" style={{ color: text }}>
                Sync logs
              </div>
              {(snapshot?.logs ?? []).length === 0 ? (
                <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}`, color: muted }}>
                  Aun no hay logs de sync.
                </div>
              ) : (
                snapshot?.logs.slice(0, 8).map((log) => (
                  <div key={log.id} className="rounded-lg p-3" style={{ background: surface, border: `1px solid ${border}` }}>
                    <div className="flex justify-between gap-3">
                      <div className="text-xs font-semibold" style={{ color: text }}>
                        {log.dataType}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{fmtDate(log.updatedAt)}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      Inicio: {fmtDate(log.lastPolledAt)} · Fin: {fmtDate(log.lastSyncedAt)}
                    </div>
                    <div className="text-[11px] mt-1" style={{ color: muted }}>
                      {rawSummary(log.raw)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold" style={{ color: text }}>
              Historial operativo
            </div>
            {historyBarrels.length === 0 ? (
              <div className={cardBase} style={{ background: surface, border: `1.5px solid ${border}`, color: muted }}>
                Aun no hay barriles cerrados para historial real.
              </div>
            ) : (
              <div className="grid gap-2">
                {historyBarrels.map((barrel) => {
                  const yieldPct = barrel.volumeMl > 0 ? (barrel.mlConsumed / barrel.volumeMl) * 100 : 0;
                  const mermaPct = barrel.volumeMl > 0 ? (barrel.mermaMl / barrel.volumeMl) * 100 : 0;
                  return (
                    <div
                      key={barrel.id}
                      className="rounded-xl p-3 grid gap-2 md:grid-cols-[1.3fr_repeat(5,0.8fr)]"
                      style={{ background: surface, border: `1px solid ${border}` }}
                    >
                      <div>
                        <div className="text-xs font-semibold" style={{ color: text }}>
                          {barrel.groupName ?? barrel.kegId ?? barrel.id}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmtDate(barrel.openedAt)} - {fmtDate(barrel.closedAt)}
                        </div>
                      </div>
                      <div className="text-[11px]">
                        <div className={smallLabel}>Litros</div>
                        <div className="font-mono" style={{ color: text }}>{(barrel.mlConsumed / 1000).toFixed(1)}L</div>
                      </div>
                      <div className="text-[11px]">
                        <div className={smallLabel}>Bruto</div>
                        <div className="font-mono" style={{ color: text }}>{fmtMoney(barrel.revenueBrutoCents)}</div>
                      </div>
                      <div className="text-[11px]">
                        <div className={smallLabel}>Desc.</div>
                        <div className="font-mono" style={{ color: text }}>{fmtMoney(barrel.revenueDescuentosCents)}</div>
                      </div>
                      <div className="text-[11px]">
                        <div className={smallLabel}>Neto</div>
                        <div className="font-mono" style={{ color: text }}>{fmtMoney(barrel.revenueNetoCents)}</div>
                      </div>
                      <div className="text-[11px]">
                        <div className={smallLabel}>Yield / merma</div>
                        <div className="font-mono" style={{ color: text }}>
                          {yieldPct.toFixed(1)}% / {mermaPct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
