"use client";

import { useState } from "react";
import { getKegBoardInitialState } from "@/lib/repositories/mock-pour-repository";
import type { Barrel, Line, Template, BarConfig, MenuConfig } from "@/lib/core/types";
import { remPct, yPct, yColor } from "@/lib/pour-utils";
import { PourLogo } from "./pour-logo";
import { LineCard } from "./line-card";
import { DetailPanel } from "./detail-panel";
import { DashboardTab } from "./dashboard-tab";
import { OperationsTab } from "./operations-tab";

const initialState = getKegBoardInitialState();

export function KegBoard() {
  const [tab, setTab] = useState<"dashboard" | "board" | "templates" | "history" | "operations" | "config" | "menu">("board");
  const [darkMode, setDarkMode] = useState(false);
  const [boardView, setBoardView] = useState<"grid" | "list">("grid");
  const [products, setProducts] = useState(initialState.products);
  const [barrels, setBarrels] = useState<Barrel[]>(initialState.barrels);
  const [templates, setTemplates] = useState<Template[]>(initialState.templates);
  const [lines, setLines] = useState<Line[]>(initialState.lines);
  const [selectedLineId, setSelectedLineId] = useState<number | null>(1);
  const [barConfig, setBarConfig] = useState<BarConfig>(initialState.barConfig);
  const [_menuConfig] = useState<MenuConfig>(initialState.menuConfig);
  const currentEmployee = initialState.employees[0];

  const getBarrel = (lineId: number) =>
    barrels.find((b) => b.lineId === lineId && b.status === "active");
  const selectedLine = lines.find((l) => l.id === selectedLineId);
  const selectedBarrel = selectedLineId ? getBarrel(selectedLineId) : undefined;

  const activeCount = lines.filter((l) => getBarrel(l.id)).length;
  const lowCount = lines.filter((l) => {
    const b = getBarrel(l.id);
    return b && remPct(b.mlConsumed, b.volumeL * 1000) < 20;
  }).length;
  const emptyCount = lines.length - activeCount;

  function handleOpen(
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
        pricePaid: data.pricePaid,
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

  function handleClose(barrelId: number, mermaMl: number, closedBy: string) {
    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? { ...b, status: "closed", mermaMl, closedAt: new Date().toISOString(), closedBy }
          : b
      )
    );
  }

  function handleEdit(barrelId: number, fields: Partial<Barrel>) {
    setBarrels((bs) =>
      bs.map((b) =>
        b.id === barrelId
          ? { ...b, ...fields, editedAt: new Date().toISOString(), editedBy: currentEmployee }
          : b
      )
    );
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
          {barrels.some((b) => b.pos_provider !== "mock") ? "POS conectado" : "Mock POS"} ·{" "}
          <span
            className="font-medium"
            style={{ color: darkMode ? "#94a3b8" : "#374151" }}
          >
            {currentEmployee}
          </span>
        </div>
      </div>

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
                    onDeselect={() => setSelectedLineId(null)}
                    onSaveTemplate={handleSaveTemplate}
                    barConfig={barConfig}
                    allBarrels={barrels}
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
                            {new Date(b.openedAt).toLocaleDateString("es-MX", {
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
