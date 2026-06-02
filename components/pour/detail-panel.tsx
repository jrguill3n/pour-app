"use client";

import { useState, useMemo } from "react";
import type { Barrel, Line, BarConfig, Template, Product } from "@/lib/core/types";
import { remPct, yPct, yColor, yBg, yBorder, fmtDate, fmtL } from "@/lib/pour-utils";
import { WaveIcon, LevelBar } from "./pour-logo";
import { ProductSelector } from "./product-selector";

const lb = {
  fontSize: 11,
  fontWeight: 500,
  color: "#6b7280",
  letterSpacing: 0.3,
  marginBottom: 5,
  display: "block" as const,
};

const inp: React.CSSProperties = {
  width: "100%",
  background: "#fff",
  border: "1.5px solid #e5e7eb",
  borderRadius: 8,
  color: "#111827",
  fontSize: 14,
  padding: "10px 12px",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

interface DetailPanelProps {
  line: Line;
  barrel: Barrel | undefined;
  products: Product[];
  templates: Template[];
  currentEmployee: string;
  onOpen: (
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
  ) => void;
  onClose: (barrelId: number, mermaMl: number, closedBy: string) => void;
  onEdit: (barrelId: number, fields: Partial<Barrel>) => void;
  onDeselect: () => void;
  onSaveTemplate: (
    data: {
      brand: string;
      group: string;
      beerStyle?: string;
      external_product_ids: string[];
      volumeL: number;
      lastPrice: number;
    },
    editId: number | null
  ) => void;
  barConfig: BarConfig;
  allBarrels: Barrel[];
  darkMode?: boolean;
}

export function DetailPanel({
  line,
  barrel,
  products,
  templates,
  currentEmployee,
  onOpen,
  onClose,
  onEdit,
  onDeselect,
  onSaveTemplate,
  barConfig,
  allBarrels,
  darkMode = false,
}: DetailPanelProps) {
  const [screen, setScreen] = useState<"view" | "open" | "close" | "edit">("view");
  const [openMode, setOpenMode] = useState<"template" | "manual">("template");
  const [editForm, setEditForm] = useState<{
    brand?: string;
    group?: string;
    beerStyle?: string;
    abv?: string;
    volumeL?: string;
    pricePaid?: string;
  }>({});
  const [form, setForm] = useState({
    brand: "",
    group: "",
    beerStyle: "",
    abv: "",
    external_product_ids: [] as string[],
    volumeL: "",
    pricePaid: "",
  });
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templatePrice, setTemplatePrice] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [mermaL, setMermaL] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);

  const lineHistory = useMemo(
    () =>
      (allBarrels || [])
        .filter((b) => b.lineId === line.id && b.status === "closed")
        .sort(
          (a, b) =>
            new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime()
        ),
    [allBarrels, line.id]
  );

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.toLowerCase();
    return !q
      ? templates
      : templates.filter(
          (t) =>
            t.brand.toLowerCase().includes(q) ||
            t.group.toLowerCase().includes(q)
        );
  }, [templates, templateSearch]);

  const isEmpty = !barrel;
  const totalMl = barrel ? barrel.volumeL * 1000 : 0;
  const rPct = barrel ? remPct(barrel.mlConsumed, totalMl) : 0;
  const consumed = barrel ? parseFloat(yPct(barrel.mlConsumed, totalMl)) : 0;
  const color = barrel ? yColor(consumed) : "#9ca3af";
  const isLow = barrel && rPct < 20;
  const isAlmostEmpty = barrel && rPct < 8;
  const barrelProducts = barrel
    ? products.filter((p) => barrel.external_product_ids.includes(p.external_product_id))
    : [];

  function handleOpenFromTemplate() {
    if (!selectedTemplate) return;
    const t = selectedTemplate;
    const price = parseFloat(templatePrice) || t.lastPrice;
    onOpen(line.id, {
      brand: t.brand,
      group: t.group,
      external_product_ids: t.external_product_ids,
      volumeL: t.volumeL,
      pricePaid: price,
      openedBy: currentEmployee,
    });
    setSelectedTemplate(null);
    setTemplatePrice("");
    setScreen("view");
  }

  function handleOpenManual() {
    if (saveAsTemplate) {
      onSaveTemplate(
        {
          brand: form.brand,
          group: form.group,
          beerStyle: form.beerStyle,
          external_product_ids: form.external_product_ids,
          volumeL: parseFloat(form.volumeL),
          lastPrice: parseFloat(form.pricePaid) || 0,
        },
        null
      );
    }
    onOpen(line.id, {
      brand: form.brand,
      group: form.group,
      beerStyle: form.beerStyle,
      abv: form.abv ? parseFloat(form.abv) : null,
      external_product_ids: form.external_product_ids,
      volumeL: parseFloat(form.volumeL),
      pricePaid: parseFloat(form.pricePaid),
      openedBy: currentEmployee,
    });
    setForm({
      brand: "",
      group: "",
      beerStyle: "",
      abv: "",
      external_product_ids: [],
      volumeL: "",
      pricePaid: "",
    });
    setSaveAsTemplate(false);
    setScreen("view");
  }

  const getProds = (ids: string[]) => products.filter((p) => ids.includes(p.external_product_id));
  const manualReady =
    form.group &&
    form.external_product_ids.length > 0 &&
    form.volumeL &&
    form.pricePaid;

  // OPEN SCREEN
  if (screen === "open") {
    return (
      <div className="h-full flex flex-col">
        <div
          className="p-4 flex items-center gap-2.5 shrink-0"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          <button
            onClick={() => {
              setScreen("view");
              setSelectedTemplate(null);
            }}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ←
          </button>
          <div>
            <div className="text-[15px] font-bold text-foreground">
              Abrir barril
            </div>
            <div className="text-xs text-muted-foreground">
              Línea {String(line.id).padStart(2, "0")}
              {line.note ? ` · ${line.note}` : ""}
            </div>
          </div>
        </div>

        <div
          className="flex gap-1.5 px-5 py-3 shrink-0"
          style={{ borderBottom: "1px solid #f3f4f6" }}
        >
          {[
            { key: "template" as const, label: "📋 Desde plantilla" },
            { key: "manual" as const, label: "✏️ Manual" },
          ].map((m) => (
            <button
              key={m.key}
              onClick={() => setOpenMode(m.key)}
              className="flex-1 py-2 rounded-lg text-xs font-medium"
              style={{
                background: openMode === m.key ? "#111827" : "#f3f4f6",
                color: openMode === m.key ? "#fff" : "#6b7280",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* TEMPLATE MODE */}
          {openMode === "template" && (
            <div>
              {templates.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay plantillas guardadas.
                  <br />
                  <button
                    onClick={() => setOpenMode("manual")}
                    className="text-primary mt-2"
                  >
                    Abrir manualmente →
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3"
                    style={{
                      background: "#f9fafb",
                      border: "1.5px solid #e5e7eb",
                    }}
                  >
                    <span className="text-muted-foreground text-sm">🔍</span>
                    <input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder="Buscar plantilla..."
                      className="flex-1 border-none outline-none text-sm bg-transparent"
                    />
                    {templateSearch && (
                      <button
                        onClick={() => setTemplateSearch("")}
                        className="text-muted-foreground text-sm"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  {filteredTemplates.length === 0 && templateSearch && (
                    <div className="text-center py-5 text-muted-foreground text-sm">
                      Sin resultados para &quot;{templateSearch}&quot;
                    </div>
                  )}
                  {filteredTemplates.map((t) => {
                    const isSelected = selectedTemplate?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTemplate(t);
                          setTemplatePrice(t.lastPrice?.toString() || "");
                        }}
                        className="rounded-lg p-3.5 mb-2 cursor-pointer transition-all"
                        style={{
                          background: isSelected ? "#fff1f2" : "#fff",
                          border: `1.5px solid ${
                            isSelected ? "#f43f5e" : "#e5e7eb"
                          }`,
                        }}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <div>
                            {t.brand && (
                              <div className="text-[10px] text-muted-foreground">
                                {t.brand}
                              </div>
                            )}
                            <div className="text-sm font-semibold text-foreground">
                              {t.group}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">
                              {t.volumeL}L
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Usado {t.timesUsed}x
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {getProds(t.external_product_ids).map((p) => (
                            <div
                              key={p.id}
                              className="text-[10px] rounded px-1.5 py-0.5"
                              style={{
                                background: isSelected ? "#fff" : "#f3f4f6",
                                border: `1px solid ${
                                  isSelected ? "#fecaca" : "#e5e7eb"
                                }`,
                                color: isSelected ? "#f43f5e" : "#6b7280",
                              }}
                            >
                              {p.variant} · {p.cupMl}ml
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {selectedTemplate && (
                    <div className="mt-1">
                      <label style={lb}>
                        Precio pagado hoy ($){" "}
                        <span className="text-red-500 text-[10px]">*</span>
                      </label>
                      <input
                        type="number"
                        value={templatePrice}
                        onChange={(e) => setTemplatePrice(e.target.value)}
                        placeholder={
                          selectedTemplate.lastPrice?.toString() || "ej. 1800"
                        }
                        style={inp}
                      />
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Último precio: $
                        {selectedTemplate.lastPrice?.toLocaleString()}
                      </div>
                      <button
                        onClick={handleOpenFromTemplate}
                        disabled={!templatePrice}
                        className="w-full mt-3.5 py-3 rounded-lg text-sm font-semibold"
                        style={{
                          background: templatePrice
                            ? "linear-gradient(135deg,#9f1239,#f43f5e)"
                            : "#f3f4f6",
                          color: templatePrice ? "#fff" : "#9ca3af",
                          cursor: templatePrice ? "pointer" : "default",
                        }}
                      >
                        Abrir en línea {String(line.id).padStart(2, "0")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* MANUAL MODE */}
          {openMode === "manual" && (
            <div>
              <div className="mb-3">
                <label style={lb}>
                  Marca{" "}
                  <span className="text-muted-foreground text-[10px] font-normal">
                    opcional
                  </span>
                </label>
                <input
                  value={form.brand}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, brand: e.target.value }))
                  }
                  placeholder="ej. Hercules..."
                  style={inp}
                />
              </div>
              <div className="mb-3">
                <label style={lb}>
                  Etiqueta{" "}
                  <span className="text-red-500 text-[10px]">*</span>
                </label>
                <input
                  value={form.group}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, group: e.target.value }))
                  }
                  placeholder="ej. Hombre Pájaro..."
                  style={inp}
                />
              </div>
              <div className="mb-3">
                <label style={lb}>
                  Estilo de cerveza{" "}
                  <span className="text-muted-foreground text-[10px] font-normal">
                    opcional
                  </span>
                </label>
                <input
                  value={form.beerStyle || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, beerStyle: e.target.value }))
                  }
                  placeholder="ej. IPA, Lager, Stout, Pale Ale..."
                  style={inp}
                />
              </div>
              <div className="mb-3">
                <label style={lb}>
                  ABV %{" "}
                  <span className="text-muted-foreground text-[10px] font-normal">
                    opcional
                  </span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="25"
                  value={form.abv || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, abv: e.target.value }))
                  }
                  placeholder="ej. 6.5"
                  style={inp}
                />
              </div>
              <div className="mb-3">
                <label style={lb}>
                  Productos vinculados{" "}
                  <span className="text-red-500 text-[10px]">*</span>
                  {form.external_product_ids.length > 0 && (
                    <span className="ml-1.5 text-primary font-semibold">
                      · {form.external_product_ids.length} seleccionados
                    </span>
                  )}
                </label>
                <ProductSelector
                  products={products}
                  selected={form.external_product_ids}
                  onChange={(ids) => setForm((f) => ({ ...f, external_product_ids: ids }))}
                  darkMode={darkMode}
                />
              </div>
              {form.external_product_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {getProds(form.external_product_ids).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-1 rounded text-[11px] px-2 py-1"
                      style={{
                        background: "#fff1f2",
                        border: "1px solid #fecaca",
                        color: "#f43f5e",
                      }}
                    >
                      {p.variant} · {p.cupMl}ml
                      <button
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            external_product_ids: f.external_product_ids.filter((x) => x !== p.external_product_id),
                          }))
                        }
                        className="text-red-300 hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label style={lb}>
                    Volumen (L){" "}
                    <span className="text-red-500 text-[10px]">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="20"
                    value={form.volumeL}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, volumeL: e.target.value }))
                    }
                    style={inp}
                  />
                </div>
                <div>
                  <label style={lb}>
                    Precio pagado ($){" "}
                    <span className="text-red-500 text-[10px]">*</span>
                  </label>
                  <input
                    type="number"
                    placeholder="1800"
                    value={form.pricePaid}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, pricePaid: e.target.value }))
                    }
                    style={inp}
                  />
                </div>
              </div>

              <div
                onClick={() => setSaveAsTemplate((v) => !v)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer mb-3.5"
                style={{
                  background: saveAsTemplate ? "#fff1f2" : "#f9fafb",
                  border: `1.5px solid ${
                    saveAsTemplate ? "#fecaca" : "#e5e7eb"
                  }`,
                }}
              >
                <div
                  className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                  style={{
                    border: `1.5px solid ${
                      saveAsTemplate ? "#f43f5e" : "#d1d5db"
                    }`,
                    background: saveAsTemplate ? "#f43f5e" : "#fff",
                  }}
                >
                  {saveAsTemplate && (
                    <span className="text-white text-[11px]">✓</span>
                  )}
                </div>
                <div>
                  <div
                    className="text-xs font-medium"
                    style={{
                      color: saveAsTemplate ? "#f43f5e" : "#374151",
                    }}
                  >
                    Guardar como plantilla
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    La próxima vez se abre en 2 taps
                  </div>
                </div>
              </div>

              <button
                disabled={!manualReady}
                onClick={handleOpenManual}
                className="w-full py-3 rounded-lg text-sm font-semibold"
                style={{
                  background: manualReady
                    ? "linear-gradient(135deg,#9f1239,#f43f5e)"
                    : "#f3f4f6",
                  color: manualReady ? "#fff" : "#9ca3af",
                  cursor: manualReady ? "pointer" : "default",
                }}
              >
                Abrir en línea {String(line.id).padStart(2, "0")}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // EDIT SCREEN
  if (screen === "edit" && barrel) {
    return (
      <div
        className="p-5 h-full overflow-y-auto"
        style={{ background: darkMode ? "#0f1117" : "#fff" }}
      >
        <div className="flex items-center gap-2.5 mb-5">
          <button
            onClick={() => setScreen("view")}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ←
          </button>
          <div>
            <div className="text-[15px] font-bold text-foreground">
              Editar barril
            </div>
            <div className="text-xs text-muted-foreground">
              Línea {String(line.id).padStart(2, "0")} · solo campos descriptivos
            </div>
          </div>
        </div>

        <div
          className="rounded-lg p-2.5 mb-4 flex gap-2"
          style={{
            background: darkMode ? "#151820" : "#fffbeb",
            border: `1.5px solid ${darkMode ? "#2a3050" : "#fde68a"}`,
          }}
        >
          <span>⚠️</span>
          <span
            className="text-xs"
            style={{ color: darkMode ? "#94a3b8" : "#92400e" }}
          >
            Los productos vinculados no se pueden cambiar. Si se abrió el barril
            incorrecto, ciérralo y abre uno nuevo.
          </span>
        </div>

        <div className="mb-3">
          <label style={lb}>
            Marca{" "}
            <span className="text-muted-foreground text-[10px] font-normal">
              opcional
            </span>
          </label>
          <input
            value={editForm.brand || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, brand: e.target.value }))
            }
            placeholder="ej. Hercules..."
            style={inp}
          />
        </div>
        <div className="mb-3">
          <label style={lb}>
            Etiqueta <span className="text-red-500 text-[10px]">*</span>
          </label>
          <input
            value={editForm.group || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, group: e.target.value }))
            }
            placeholder="ej. Hombre Pájaro..."
            style={inp}
          />
        </div>
        <div className="mb-3">
          <label style={lb}>
            Estilo de cerveza{" "}
            <span className="text-muted-foreground text-[10px] font-normal">
              opcional
            </span>
          </label>
          <input
            value={editForm.beerStyle || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, beerStyle: e.target.value }))
            }
            placeholder="ej. IPA, Lager..."
            style={inp}
          />
        </div>
        <div className="mb-3">
          <label style={lb}>
            ABV %{" "}
            <span className="text-muted-foreground text-[10px] font-normal">
              opcional
            </span>
          </label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="25"
            value={editForm.abv || ""}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, abv: e.target.value }))
            }
            placeholder="ej. 6.5"
            style={inp}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div>
            <label style={lb}>Volumen (L)</label>
            <input
              type="number"
              value={editForm.volumeL || ""}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, volumeL: e.target.value }))
              }
              style={inp}
            />
          </div>
          <div>
            <label style={lb}>Precio pagado ($)</label>
            <input
              type="number"
              value={editForm.pricePaid || ""}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, pricePaid: e.target.value }))
              }
              style={inp}
            />
          </div>
        </div>

        <div className="mb-5">
          <label style={lb}>
            Productos vinculados{" "}
            <span className="text-muted-foreground text-[10px]">(no editable)</span>
          </label>
          <div className="flex flex-wrap gap-1">
            {barrelProducts.map((p) => (
              <div
                key={p.id}
                className="text-[11px] rounded px-2 py-1"
                style={{
                  background: darkMode ? "#1c2030" : "#f3f4f6",
                  border: `1px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                  color: darkMode ? "#475569" : "#6b7280",
                }}
              >
                {p.variant} · {p.cupMl}ml
              </div>
            ))}
          </div>
        </div>

        <button
          disabled={!editForm.group}
          onClick={() => {
            onEdit(barrel.id, {
              brand: editForm.brand,
              group: editForm.group,
              beerStyle: editForm.beerStyle,
              abv: editForm.abv ? parseFloat(editForm.abv) : null,
              volumeL: editForm.volumeL
                ? parseFloat(editForm.volumeL)
                : barrel.volumeL,
              pricePaid: editForm.pricePaid
                ? parseFloat(editForm.pricePaid)
                : barrel.pricePaid,
            });
            setScreen("view");
          }}
          className="w-full py-3 rounded-lg text-sm font-semibold"
          style={{
            background: editForm.group
              ? "linear-gradient(135deg,#9f1239,#f43f5e)"
              : "#f3f4f6",
            color: editForm.group ? "#fff" : "#9ca3af",
            cursor: editForm.group ? "pointer" : "default",
          }}
        >
          Guardar cambios
        </button>
      </div>
    );
  }

  // CLOSE SCREEN
  if (screen === "close" && barrel) {
    const mermaActualMl = mermaL ? parseFloat(mermaL) * 1000 : 0;
    const finalYield = parseFloat(yPct(barrel.mlConsumed + mermaActualMl, totalMl));
    const fColor = yColor(finalYield);

    const maxMermaPct = barConfig?.maxMermaPct || 8;
    const pricePerMl = barConfig?.pricePerMl || 0.2;
    const mermaPct = (mermaActualMl / totalMl) * 100;
    const maxMermaMl = (maxMermaPct / 100) * totalMl;
    const excessMl = Math.max(0, mermaActualMl - maxMermaMl);
    const excessCost = excessMl * pricePerMl;
    const mermaOk = mermaL ? mermaPct <= maxMermaPct : null;

    return (
      <div className="p-5 h-full overflow-y-auto">
        <div className="flex items-center gap-2.5 mb-5">
          <button
            onClick={() => setScreen("view")}
            className="text-muted-foreground hover:text-foreground text-lg"
          >
            ←
          </button>
          <div>
            <div className="text-[15px] font-bold text-foreground">
              Cerrar barril
            </div>
            <div className="text-xs text-muted-foreground">
              Línea {String(line.id).padStart(2, "0")} · {barrel.group}
            </div>
          </div>
        </div>

        <div className="flex justify-center mb-5">
          <WaveIcon fillPct={rPct} size={68} />
        </div>

        <div
          className="rounded-lg p-3.5 mb-3"
          style={{
            background: darkMode ? "#151820" : "#f9fafb",
            border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
          }}
        >
          {[
            ["Total del barril", fmtL(totalMl)],
            ["Vendido POS", fmtL(barrel.mlConsumed)],
            ["Restante estimado", fmtL(totalMl - barrel.mlConsumed)],
          ].map(([l, v]) => (
            <div
              key={l}
              className="flex justify-between pb-2 mb-2"
              style={{
                borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
              }}
            >
              <span
                className="text-sm"
                style={{ color: darkMode ? "#475569" : "#6b7280" }}
              >
                {l}
              </span>
              <span
                className="font-mono text-sm font-semibold"
                style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
              >
                {v}
              </span>
            </div>
          ))}
          <div>
            <label style={lb}>Merma real (L que quedaron)</label>
            <input
              type="number"
              step="0.1"
              placeholder="0.0"
              value={mermaL}
              onChange={(e) => setMermaL(e.target.value)}
              style={inp}
            />
          </div>
        </div>

        {/* Final yield */}
        <div
          className="rounded-lg py-3 px-4 mb-2.5 flex justify-between items-center"
          style={{
            background: yBg(finalYield),
            border: `1.5px solid ${yBorder(finalYield)}`,
          }}
        >
          <span className="text-sm text-muted-foreground">Rendimiento final</span>
          <span
            className="font-mono text-2xl font-bold"
            style={{ color: fColor }}
          >
            {finalYield}%
          </span>
        </div>

        {/* Merma indicator */}
        {mermaL && (
          <div
            className="rounded-lg py-3 px-4 mb-3.5"
            style={{
              background: mermaOk ? "#f0fdf4" : "#fef2f2",
              border: `1.5px solid ${mermaOk ? "#bbf7d0" : "#fecaca"}`,
            }}
          >
            <div
              className={`flex justify-between items-center ${
                mermaOk ? "" : "mb-2"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-base">{mermaOk ? "✅" : "⚠️"}</span>
                <span
                  className="text-sm font-semibold"
                  style={{ color: mermaOk ? "#16a34a" : "#dc2626" }}
                >
                  {mermaOk ? "Merma dentro del rango" : "Merma fuera del rango"}
                </span>
              </div>
              <span
                className="font-mono text-sm font-bold"
                style={{ color: mermaOk ? "#16a34a" : "#dc2626" }}
              >
                {mermaPct.toFixed(1)}% / {maxMermaPct}%
              </span>
            </div>
            {!mermaOk && (
              <div className="bg-red-100 rounded px-2.5 py-2 flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  Pérdida por exceso de merma
                </span>
                <span className="font-mono text-[15px] font-bold text-red-600">
                  −${Math.round(excessCost).toLocaleString()} MXN
                </span>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => {
            onClose(barrel.id, mermaActualMl, currentEmployee);
            setMermaL("");
            setScreen("view");
          }}
          className="w-full py-3 rounded-lg text-sm font-semibold"
          style={{
            background: "#fff",
            border: "1.5px solid #fca5a5",
            color: "#dc2626",
            cursor: "pointer",
          }}
        >
          Confirmar cierre · liberar línea {String(line.id).padStart(2, "0")}
        </button>
      </div>
    );
  }

  // VIEW SCREEN
  return (
    <div className="p-5 h-full overflow-y-auto">
      <div className="flex justify-between items-start mb-5">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <div
              className="font-mono text-xl font-bold"
              style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
            >
              Línea {String(line.id).padStart(2, "0")}
            </div>
            {line.note && (
              <div className="text-[10px] tracking-wide uppercase text-purple-600 bg-purple-100 rounded px-2 py-0.5">
                {line.note}
              </div>
            )}
          </div>
          <div
            className="text-xs"
            style={{ color: darkMode ? "#475569" : "#9ca3af" }}
          >
            {isEmpty
              ? "Sin barril activo"
              : `Activo desde ${fmtDate(barrel.openedAt)}`}
          </div>
        </div>
        <button
          onClick={onDeselect}
          className="text-muted-foreground hover:text-foreground text-lg p-0.5"
        >
          ✕
        </button>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-3.5 py-7">
          <div
            className="w-[60px] h-[60px] rounded-xl flex items-center justify-center text-2xl"
            style={{
              background: darkMode ? "#151820" : "#f9fafb",
              border: `2px dashed ${darkMode ? "#2a3050" : "#e5e7eb"}`,
              color: "#d1d5db",
            }}
          >
            +
          </div>
          <div className="text-muted-foreground text-sm text-center leading-relaxed">
            Línea vacía
            <br />
            lista para conectar
          </div>
          <button
            onClick={() => setScreen("open")}
            className="py-2.5 px-7 rounded-lg text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg,#9f1239,#f43f5e)",
            }}
          >
            + Abrir barril
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-3.5 items-center mb-4">
            <WaveIcon fillPct={rPct} size={58} />
            <div className="flex-1">
              {barrel.brand && (
                <div className="text-[11px] text-muted-foreground mb-0.5">
                  {barrel.brand}
                  {barrel.beerStyle ? ` · ${barrel.beerStyle}` : ""}
                </div>
              )}
              <div
                className="text-base font-bold mb-1.5"
                style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
              >
                {barrel.group}
              </div>
              <div className="flex gap-5">
                <div>
                  <div
                    className="text-[10px] uppercase tracking-wide"
                    style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                  >
                    Restante
                  </div>
                  <div
                    className="font-mono text-[17px] font-bold"
                    style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                  >
                    {fmtL(totalMl - barrel.mlConsumed)}
                  </div>
                </div>
                <div>
                  <div
                    className="text-[10px] uppercase tracking-wide"
                    style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                  >
                    Consumido
                  </div>
                  <div
                    className="font-mono text-[17px] font-bold"
                    style={{ color }}
                  >
                    {consumed}%
                  </div>
                </div>
              </div>
            </div>
          </div>
          <LevelBar pct={rPct} color={color} />

          {isAlmostEmpty && (
            <div
              className="mt-3 rounded-lg py-2.5 px-3 flex gap-2"
              style={{
                background: "#fef2f2",
                border: "1.5px solid #fecaca",
              }}
            >
              <span>⚠️</span>
              <span className="text-red-600 text-xs">Barril casi vacío</span>
            </div>
          )}
          {!isAlmostEmpty && isLow && (
            <div
              className="mt-3 rounded-lg py-2.5 px-3 flex gap-2"
              style={{
                background: "#fffbeb",
                border: "1.5px solid #fde68a",
              }}
            >
              <span>🔔</span>
              <span className="text-amber-600 text-xs">
                Nivel bajo — menos del 20%
              </span>
            </div>
          )}

          {/* Sales by format */}
          <div className="mt-3.5 mb-3">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
              Ventas por formato
            </div>
            <div
              className="rounded-lg overflow-hidden"
              style={{
                background: darkMode ? "#151820" : "#f9fafb",
                border: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
              }}
            >
              {barrelProducts.map((p, i) => {
                const totalMlWeight = barrelProducts.reduce(
                  (s, bp) => s + bp.cupMl,
                  0
                );
                const share = p.cupMl / totalMlWeight;
                const unitsSold = Math.round(
                  (barrel.mlConsumed * share) / p.cupMl
                );
                const mlFromProduct = unitsSold * p.cupMl;
                const isLast = i === barrelProducts.length - 1;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2.5 py-2.5 px-3"
                    style={{
                      borderBottom: isLast
                        ? "none"
                        : `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium overflow-hidden text-ellipsis whitespace-nowrap"
                        style={{ color: darkMode ? "#e2e8f0" : "#374151" }}
                      >
                        {p.variant}
                      </div>
                      <div
                        className="text-[11px] mt-0.5"
                        style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                      >
                        {p.cupMl}ml por servicio
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="font-mono text-[15px] font-bold"
                        style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                      >
                        {unitsSold}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fmtL(mlFromProduct)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div
                className="flex justify-between items-center py-2.5 px-3"
                style={{
                  borderTop: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                  background: darkMode ? "#1c2030" : "#f3f4f6",
                }}
              >
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: darkMode ? "#94a3b8" : "#374151" }}
                >
                  Total consumido
                </span>
                <span
                  className="font-mono text-sm font-bold"
                  style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
                >
                  {fmtL(barrel.mlConsumed)}
                </span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div
            className="rounded-lg py-2.5 px-3 mb-4"
            style={{ background: darkMode ? "#151820" : "#f9fafb" }}
          >
            {[
              ["Abierto por", barrel.openedBy],
              ["Precio pagado", `$${barrel.pricePaid.toLocaleString()}`],
              ["Volumen", `${barrel.volumeL}L`],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between mb-1">
                <span
                  className="text-xs"
                  style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                >
                  {l}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{ color: darkMode ? "#94a3b8" : "#374151" }}
                >
                  {v}
                </span>
              </div>
            ))}
            {barrel.editedAt && (
              <div
                className="flex justify-between items-center mt-2 pt-2"
                style={{
                  borderTop: `1px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                }}
              >
                <div className="flex items-center gap-1">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z"
                      stroke={darkMode ? "#475569" : "#9ca3af"}
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className="text-[11px]"
                    style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                  >
                    Editado
                  </span>
                </div>
                <span
                  className="text-[11px]"
                  style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                >
                  {barrel.editedBy} · {fmtDate(barrel.editedAt)}
                </span>
              </div>
            )}
          </div>

          {/* Revenue section */}
          {barrel.revenueBrutoCents && barrel.revenueBrutoCents > 0 && (
            <div
              className="rounded-lg py-2.5 px-3 mb-3"
              style={{
                background: darkMode ? "#151820" : "#f0fdf4",
                border: `1px solid ${darkMode ? "#2a3050" : "#bbf7d0"}`,
              }}
            >
              <div className="text-[10px] tracking-wider uppercase text-green-600 mb-2 font-semibold">
                Revenue del barril
              </div>
              {(() => {
                const bruto = barrel.revenueBrutoCents / 100;
                const desc = (barrel.revenueDescuentosCents || 0) / 100;
                const neto = (barrel.revenueNetoCents || 0) / 100;
                const margen =
                  barrel.pricePaid > 0
                    ? (((neto - barrel.pricePaid) / neto) * 100).toFixed(1)
                    : null;
                const revPerL =
                  barrel.mlConsumed > 0
                    ? (neto / (barrel.mlConsumed / 1000)).toFixed(2)
                    : null;
                const rows: [string, string, string?][] = [
                  ["Bruto", `$${bruto.toLocaleString()}`],
                  ...(desc > 0
                    ? ([["Descuentos", `-$${desc.toLocaleString()}`, "#dc2626"]] as [string, string, string?][])
                    : []),
                  ["Neto", `$${neto.toLocaleString()}`],
                  ...(margen
                    ? ([["Margen bruto", `${margen}%`, "#16a34a"]] as [string, string, string?][])
                    : []),
                  ...(revPerL ? ([["$/litro vendido", `$${revPerL}`]] as [string, string, string?][]) : []),
                ];
                return rows.map(([l, v, customColor], i) => (
                  <div
                    key={l}
                    className="flex justify-between"
                    style={{
                      paddingBottom: i < rows.length - 1 ? 6 : 0,
                      marginBottom: i < rows.length - 1 ? 6 : 0,
                      borderBottom:
                        i < rows.length - 1
                          ? `1px solid ${darkMode ? "#2a3050" : "#d1fae5"}`
                          : "none",
                    }}
                  >
                    <span
                      className="text-xs"
                      style={{ color: darkMode ? "#475569" : "#6b7280" }}
                    >
                      {l}
                    </span>
                    <span
                      className="font-mono text-xs font-semibold"
                      style={{
                        color:
                          customColor ||
                          (darkMode ? "#e2e8f0" : "#111827"),
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ));
              })()}
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => {
                setEditForm({
                  brand: barrel.brand,
                  group: barrel.group,
                  beerStyle: barrel.beerStyle,
                  abv: barrel.abv?.toString(),
                  volumeL: barrel.volumeL.toString(),
                  pricePaid: barrel.pricePaid.toString(),
                });
                setScreen("edit");
              }}
              className="flex-1 py-3 rounded-lg text-xs font-medium"
              style={{
                background: darkMode ? "#151820" : "#fff",
                border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                color: darkMode ? "#475569" : "#6b7280",
              }}
            >
              Editar
            </button>
            <button
              onClick={() => setScreen("close")}
              className="flex-[2] py-3 rounded-lg text-xs font-medium"
              style={{
                background: darkMode ? "#151820" : "#fff",
                border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
                color: darkMode ? "#475569" : "#6b7280",
              }}
            >
              Cerrar barril · línea {String(line.id).padStart(2, "0")}
            </button>
          </div>

          {/* Line history */}
          {lineHistory.length > 0 && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">
                Barriles anteriores en esta línea
              </div>
              {lineHistory.slice(0, 3).map((b) => {
                const bTotalMl = b.volumeL * 1000;
                const bYield = parseFloat(yPct(b.mlConsumed, bTotalMl));
                const bColor = yColor(bYield);
                const mermaPct = (b.mermaMl / bTotalMl) * 100;
                const mermaOkB = mermaPct <= (barConfig?.maxMermaPct || 8);
                return (
                  <div
                    key={b.id}
                    className="rounded-lg py-2.5 px-3 mb-1.5 flex items-center gap-2.5"
                    style={{
                      background: darkMode ? "#151820" : "#f9fafb",
                      border: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      {b.brand && (
                        <div className="text-[10px] text-muted-foreground">
                          {b.brand}
                        </div>
                      )}
                      <div className="text-xs font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap">
                        {b.group}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {fmtDate(b.closedAt)} · {b.openedBy}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="font-mono text-sm font-bold"
                        style={{ color: bColor }}
                      >
                        {bYield}%
                      </div>
                      <div
                        className="text-[10px] mt-0.5"
                        style={{
                          color: mermaOkB ? "#16a34a" : "#dc2626",
                        }}
                      >
                        {mermaOkB ? "✓ merma ok" : "⚠ merma alta"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
