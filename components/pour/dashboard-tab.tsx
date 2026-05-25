"use client";

import { useState, useMemo } from "react";
import type { Barrel, Line, BarConfig } from "@/lib/pour-data";
import { yPct, yColor } from "@/lib/pour-utils";

interface DashboardTabProps {
  barrels: Barrel[];
  lines: Line[];
  barConfig: BarConfig;
  darkMode?: boolean;
}

export function DashboardTab({
  barrels,
  lines,
  barConfig,
  darkMode = false,
}: DashboardTabProps) {
  const [period, setPeriod] = useState<"month" | "week" | "30days">("month");

  const maxMermaPct = barConfig?.maxMermaPct || 8;
  const pricePerMl = barConfig?.pricePerMl || 0.2;

  const now = new Date();
  const periodStart = useMemo(() => {
    if (period === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    if (period === "30days") {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return d;
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, [period, now]);

  const closed = useMemo(
    () =>
      barrels.filter(
        (b) =>
          b.status === "closed" &&
          !b.voided &&
          b.closedAt &&
          new Date(b.closedAt) >= periodStart
      ),
    [barrels, periodStart]
  );

  const active = barrels.filter((b) => b.status === "active");

  // Core metrics
  const totalBarrels = closed.length;
  const totalLitersML = closed.reduce((s, b) => s + b.mlConsumed, 0);
  const totalLiters = (totalLitersML / 1000).toFixed(1);
  const totalCost = closed.reduce((s, b) => s + b.pricePaid, 0);
  const totalMermaML = closed.reduce((s, b) => s + b.mermaMl, 0);
  const totalMermaL = (totalMermaML / 1000).toFixed(1);
  const totalMermaLost = closed.reduce((s, b) => {
    const maxMl = (maxMermaPct / 100) * b.volumeL * 1000;
    return s + Math.max(0, b.mermaMl - maxMl) * pricePerMl;
  }, 0);
  const avgYield =
    totalBarrels > 0
      ? (
          closed.reduce(
            (s, b) =>
              s + parseFloat(((b.mlConsumed / (b.volumeL * 1000)) * 100).toFixed(1)),
            0
          ) / totalBarrels
        ).toFixed(1)
      : "0";
  const highMermaCount = closed.filter(
    (b) => (b.mermaMl / (b.volumeL * 1000)) * 100 > maxMermaPct
  ).length;

  // Rotation
  const avgDaysPerBarrel =
    totalBarrels > 0
      ? (
          closed.reduce((s, b) => {
            const days =
              (new Date(b.closedAt!).getTime() -
                new Date(b.openedAt).getTime()) /
              (1000 * 60 * 60 * 24);
            return s + days;
          }, 0) / totalBarrels
        ).toFixed(1)
      : "0";
  const barrelsPerWeek = (
    totalBarrels /
    Math.max(1, (now.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24 * 7))
  ).toFixed(1);

  // Volume
  const avgVolume =
    totalBarrels > 0
      ? (closed.reduce((s, b) => s + b.volumeL, 0) / totalBarrels).toFixed(1)
      : "0";
  const totalVolumePurchased = closed.reduce((s, b) => s + b.volumeL, 0);
  const overallEfficiency =
    totalVolumePurchased > 0
      ? ((totalLitersML / (totalVolumePurchased * 1000)) * 100).toFixed(1)
      : "0";
  const costPerLiter =
    totalLitersML > 0
      ? (totalCost / (totalLitersML / 1000)).toFixed(2)
      : "0";

  // Styles
  const styleCounts: Record<string, number> = {};
  const styleYields: Record<string, number[]> = {};
  const styleLiters: Record<string, number> = {};
  closed.forEach((b) => {
    const k = b.beerStyle || "Sin estilo";
    styleCounts[k] = (styleCounts[k] || 0) + 1;
    styleYields[k] = styleYields[k] || [];
    styleYields[k].push(
      parseFloat(((b.mlConsumed / (b.volumeL * 1000)) * 100).toFixed(1))
    );
    styleLiters[k] = (styleLiters[k] || 0) + b.mlConsumed / 1000;
  });

  // Staff
  const staff: Record<string, { count: number; totalYield: number; totalMerma: number; totalLiters: number }> = {};
  closed.forEach((b) => {
    if (!staff[b.openedBy])
      staff[b.openedBy] = { count: 0, totalYield: 0, totalMerma: 0, totalLiters: 0 };
    staff[b.openedBy].count++;
    staff[b.openedBy].totalYield += parseFloat(
      ((b.mlConsumed / (b.volumeL * 1000)) * 100).toFixed(1)
    );
    staff[b.openedBy].totalMerma += b.mermaMl;
    staff[b.openedBy].totalLiters += b.mlConsumed / 1000;
  });
  const staffArr = Object.entries(staff)
    .map(([name, s]) => ({
      name,
      count: s.count,
      avgYield: (s.totalYield / s.count).toFixed(1),
      totalMermaL: (s.totalMerma / 1000).toFixed(1),
      totalLiters: s.totalLiters.toFixed(1),
    }))
    .sort((a, b) => parseFloat(b.avgYield) - parseFloat(a.avgYield));

  // Lines
  const lowLines = active.filter(
    (b) => 100 - (b.mlConsumed / (b.volumeL * 1000)) * 100 < 20
  );
  const critLines = active.filter(
    (b) => 100 - (b.mlConsumed / (b.volumeL * 1000)) * 100 < 8
  );
  const sorted = [...closed].sort(
    (a, b) => b.mlConsumed / b.volumeL - a.mlConsumed / a.volumeL
  );
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  // Brands
  const brandCounts: Record<string, number> = {};
  closed.forEach((b) => {
    const k = b.brand || "Sin marca";
    brandCounts[k] = (brandCounts[k] || 0) + 1;
  });

  // Theme helpers
  const c = (l: string, d: string) => (darkMode ? d : l);
  const bg = c("#f9fafb", "#0c0f18");
  const cardBg = c("#fff", "#151820");
  const cardBdr = c("#e5e7eb", "#2a3050");
  const hdrBg = c("#fff", "#0f1117");
  const hdrBdr = c("#f3f4f6", "#2a3050");
  const T = c("#111827", "#e2e8f0");
  const S = c("#6b7280", "#475569");
  const M = c("#9ca3af", "#2a3050");
  const divider = c("#f3f4f6", "#1c2030");

  const periodLabel =
    period === "week"
      ? "Últimos 7 días"
      : period === "30days"
      ? "Últimos 30 días"
      : "Mes en curso";

  const Card = ({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) => (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBdr}`,
        borderRadius: 12,
        padding: "14px 16px",
        ...style,
      }}
    >
      {children}
    </div>
  );

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: M,
        marginBottom: 10,
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  );

  const Stat = ({
    label,
    value,
    sub,
    color,
    mono = true,
  }: {
    label: string;
    value: string | number;
    sub?: string;
    color?: string;
    mono?: boolean;
  }) => (
    <div>
      <div style={{ fontSize: 10, color: S, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontFamily: mono ? "'DM Mono', monospace" : "inherit",
          fontSize: 22,
          fontWeight: 700,
          color: color || T,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: M, marginTop: 3 }}>{sub}</div>}
    </div>
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex justify-between items-center px-5 py-3 shrink-0"
        style={{
          borderBottom: `1px solid ${hdrBdr}`,
          background: hdrBg,
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: T }}>Dashboard</div>
          <div style={{ fontSize: 11, color: S, marginTop: 1 }}>
            {periodLabel} · {totalBarrels} barril{totalBarrels !== 1 ? "es" : ""} cerrado
            {totalBarrels !== 1 ? "s" : ""}
          </div>
        </div>
        <div
          className="flex gap-0.5 rounded-lg p-0.5"
          style={{ background: c("#f3f4f6", "#1c2030") }}
        >
          {[
            { k: "month" as const, l: "Mes" },
            { k: "week" as const, l: "7d" },
            { k: "30days" as const, l: "30d" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => setPeriod(p.k)}
              className="px-2.5 py-1 rounded text-xs transition-all"
              style={{
                background:
                  period === p.k ? c("#fff", "#2a3050") : "transparent",
                color: period === p.k ? T : S,
                fontWeight: period === p.k ? 600 : 400,
              }}
            >
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4"
        style={{ background: bg }}
      >
        {/* Alerts */}
        {critLines.length > 0 && (
          <div
            className="rounded-lg py-2.5 px-3.5 mb-3 flex gap-2.5 items-center"
            style={{
              background: c("#fef2f2", "#1a0f0f"),
              border: `1px solid ${c("#fecaca", "#7c1515")}`,
            }}
          >
            <span className="text-base">⚠️</span>
            <div>
              <div className="text-xs font-semibold text-red-600">
                {critLines.length} barril{critLines.length !== 1 ? "es" : ""} casi vacío
                {critLines.length !== 1 ? "s" : ""}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: c("#b91c1c", "#ef4444") }}>
                {critLines.map((b) => b.group).join(", ")}
              </div>
            </div>
          </div>
        )}
        {lowLines.length > 0 && !critLines.length && (
          <div
            className="rounded-lg py-2.5 px-3.5 mb-3 flex gap-2.5 items-center"
            style={{
              background: c("#fffbeb", "#1a1500"),
              border: `1px solid ${c("#fde68a", "#78700a")}`,
            }}
          >
            <span className="text-base">🔔</span>
            <div>
              <div className="text-xs font-semibold text-amber-600">
                {lowLines.length} línea{lowLines.length !== 1 ? "s" : ""} con nivel bajo
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: c("#92400e", "#fbbf24") }}>
                {lowLines.map((b) => b.group).join(", ")}
              </div>
            </div>
          </div>
        )}

        {/* Consumo y rotación */}
        <SectionLabel>Consumo y rotación</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <Card><Stat label="Litros vendidos" value={`${totalLiters}L`} sub="ml consumidos" /></Card>
          <Card><Stat label="Barriles cerrados" value={totalBarrels} sub={`${barrelsPerWeek}/semana`} /></Card>
          <Card><Stat label="Días por barril" value={`${avgDaysPerBarrel}d`} sub="promedio de rotación" /></Card>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <Card><Stat label="Vol. promedio" value={`${avgVolume}L`} sub="por barril" /></Card>
          <Card><Stat label="Vol. total comprado" value={`${totalVolumePurchased}L`} sub="en el período" /></Card>
          <Card><Stat label="Líneas activas" value={active.length} sub={`de ${lines.length} en total`} color="#16a34a" /></Card>
        </div>

        {/* Rendimiento y merma */}
        <SectionLabel>Rendimiento y merma</SectionLabel>
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          <Card><Stat label="Rendimiento promedio" value={`${avgYield}%`} sub="de todos los barriles" color={yColor(avgYield)} /></Card>
          <Card><Stat label="Eficiencia global" value={`${overallEfficiency}%`} sub="vendido vs. comprado" color={yColor(overallEfficiency)} /></Card>
          <Card><Stat label="Barriles merma alta" value={highMermaCount} sub={`>${maxMermaPct}% de merma`} color={highMermaCount > 0 ? "#dc2626" : T} /></Card>
        </div>
        <div className="grid grid-cols-3 gap-2.5 mb-4">
          <Card><Stat label="Merma total" value={`${totalMermaL}L`} sub="líquido no vendido" /></Card>
          <Card><Stat label="Pérdida por merma" value={`$${Math.round(totalMermaLost).toLocaleString()}`} sub="MXN sobre el umbral" color={totalMermaLost > 0 ? "#dc2626" : T} /></Card>
          <Card><Stat label="Costo por litro vendido" value={`$${costPerLiter}`} sub="MXN / litro" /></Card>
        </div>

        {/* Revenue */}
        {(() => {
          const totalBruto = closed.reduce((s, b) => s + (b.revenueBrutoCents || 0), 0) / 100;
          const totalDesc = closed.reduce((s, b) => s + (b.revenueDescuentosCents || 0), 0) / 100;
          const totalNeto = closed.reduce((s, b) => s + (b.revenueNetoCents || 0), 0) / 100;
          const margenProm = totalNeto > 0 ? (((totalNeto - totalCost) / totalNeto) * 100).toFixed(1) : null;
          const revPerL = totalLitersML > 0 ? (totalNeto / (totalLitersML / 1000)).toFixed(2) : null;
          if (totalBruto === 0) return null;
          return (
            <>
              <SectionLabel>Revenue</SectionLabel>
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                <Card><Stat label="Revenue bruto" value={`$${Math.round(totalBruto).toLocaleString()}`} sub="sin descuentos" color="#16a34a" /></Card>
                <Card><Stat label="Descuentos aplicados" value={`-$${Math.round(totalDesc).toLocaleString()}`} sub={`${totalBruto > 0 ? ((totalDesc / totalBruto) * 100).toFixed(1) : 0}% del bruto`} color={totalDesc > 0 ? "#dc2626" : T} /></Card>
                <Card><Stat label="Revenue neto" value={`$${Math.round(totalNeto).toLocaleString()}`} sub="lo que entró a caja" color="#16a34a" /></Card>
              </div>
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                <Card><Stat label="Margen bruto" value={margenProm ? `${margenProm}%` : "—"} sub="(neto - costo) / neto" color={margenProm && parseFloat(margenProm) > 40 ? "#16a34a" : "#d97706"} /></Card>
                <Card><Stat label="Revenue por litro" value={revPerL ? `$${revPerL}` : "—"} sub="MXN / litro vendido" /></Card>
                <Card><Stat label="ROI del período" value={totalCost > 0 ? `${(((totalNeto - totalCost) / totalCost) * 100).toFixed(0)}%` : "—"} sub="retorno sobre inversión" color={totalNeto > totalCost ? "#16a34a" : "#dc2626"} /></Card>
              </div>
            </>
          );
        })()}

        {/* Costos */}
        <SectionLabel>Costos</SectionLabel>
        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <Card><Stat label="Inversión en barriles" value={`$${totalCost.toLocaleString()}`} sub="MXN total del período" /></Card>
          <Card><Stat label="Costo promedio por barril" value={totalBarrels > 0 ? `$${Math.round(totalCost / totalBarrels).toLocaleString()}` : "—"} sub="MXN por barril" /></Card>
        </div>

        {/* Best/Worst */}
        {closed.length > 0 && (
          <>
            <SectionLabel>Extremos del período</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {best && (
                <Card>
                  <div className="text-[10px] tracking-wide uppercase text-green-600 mb-2">✓ Mejor rendimiento</div>
                  {best.kegId && <div className="font-mono text-[9px] text-muted-foreground mb-1">{best.kegId}</div>}
                  {best.brand && <div className="text-[10px] text-muted-foreground mb-0.5">{best.brand}</div>}
                  <div className="text-sm font-bold mb-1.5" style={{ color: T }}>{best.group}</div>
                  <div className="font-mono text-xl font-bold text-green-600">{((best.mlConsumed / (best.volumeL * 1000)) * 100).toFixed(1)}%</div>
                  <div className="text-[11px] mt-1" style={{ color: S }}>{best.openedBy} · {best.volumeL}L</div>
                </Card>
              )}
              {worst && totalBarrels > 1 && (
                <Card>
                  <div className="text-[10px] tracking-wide uppercase text-red-600 mb-2">⚠ Menor rendimiento</div>
                  {worst.kegId && <div className="font-mono text-[9px] text-muted-foreground mb-1">{worst.kegId}</div>}
                  {worst.brand && <div className="text-[10px] text-muted-foreground mb-0.5">{worst.brand}</div>}
                  <div className="text-sm font-bold mb-1.5" style={{ color: T }}>{worst.group}</div>
                  <div className="font-mono text-xl font-bold text-red-600">{((worst.mlConsumed / (worst.volumeL * 1000)) * 100).toFixed(1)}%</div>
                  <div className="text-[11px] mt-1" style={{ color: S }}>{worst.openedBy} · {worst.volumeL}L</div>
                </Card>
              )}
            </div>
          </>
        )}

        {/* Style rotation */}
        {Object.keys(styleCounts).length > 0 && (
          <>
            <SectionLabel>Rotación por estilo de cerveza</SectionLabel>
            <Card style={{ marginBottom: 16 }}>
              {Object.entries(styleCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([style, count], i, arr) => {
                  const maxC = Math.max(...Object.values(styleCounts));
                  const avgY = styleYields[style]
                    ? (
                        styleYields[style].reduce((s, v) => s + v, 0) /
                        styleYields[style].length
                      ).toFixed(1)
                    : "-";
                  const liters = styleLiters[style]?.toFixed(1) || 0;
                  return (
                    <div
                      key={style}
                      style={{
                        marginBottom: i < arr.length - 1 ? 12 : 0,
                        paddingBottom: i < arr.length - 1 ? 12 : 0,
                        borderBottom: i < arr.length - 1 ? `1px solid ${divider}` : "none",
                      }}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: T }}>{style}</span>
                        <div className="flex gap-3">
                          <span className="text-[11px]" style={{ color: S }}>{count} barril{count !== 1 ? "es" : ""}</span>
                          <span className="font-mono text-[11px]" style={{ color: S }}>{liters}L</span>
                          <span className="font-mono text-[11px] font-semibold" style={{ color: yColor(avgY) }}>{avgY}%</span>
                        </div>
                      </div>
                      <div className="h-1 rounded-sm overflow-hidden" style={{ background: c("#f3f4f6", "#1c2030") }}>
                        <div className="h-full rounded-sm" style={{ width: `${(count / maxC) * 100}%`, background: "linear-gradient(90deg,#9f1239,#f43f5e)" }} />
                      </div>
                    </div>
                  );
                })}
            </Card>
          </>
        )}

        {/* Brand rotation */}
        {Object.keys(brandCounts).length > 1 && (
          <>
            <SectionLabel>Rotación por marca</SectionLabel>
            <Card style={{ marginBottom: 16 }}>
              {Object.entries(brandCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([brand, count], i, arr) => {
                  const maxC = Math.max(...Object.values(brandCounts));
                  return (
                    <div
                      key={brand}
                      style={{
                        marginBottom: i < arr.length - 1 ? 10 : 0,
                        paddingBottom: i < arr.length - 1 ? 10 : 0,
                        borderBottom: i < arr.length - 1 ? `1px solid ${divider}` : "none",
                      }}
                    >
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: T }}>{brand}</span>
                        <span className="text-[11px]" style={{ color: S }}>{count} barril{count !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: c("#f3f4f6", "#1c2030") }}>
                        <div className="h-full rounded-sm" style={{ width: `${(count / maxC) * 100}%`, background: c("#111827", "#e2e8f0") }} />
                      </div>
                    </div>
                  );
                })}
            </Card>
          </>
        )}

        {/* Staff */}
        {staffArr.length > 0 && (
          <>
            <SectionLabel>Rendimiento por encargado</SectionLabel>
            <Card style={{ marginBottom: 16 }}>
              {staffArr.map((s, i) => (
                <div
                  key={s.name}
                  className="flex items-center gap-3"
                  style={{
                    paddingBottom: i < staffArr.length - 1 ? 12 : 0,
                    marginBottom: i < staffArr.length - 1 ? 12 : 0,
                    borderBottom: i < staffArr.length - 1 ? `1px solid ${divider}` : "none",
                  }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: "linear-gradient(135deg,#9f1239,#f43f5e)" }}
                  >
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium" style={{ color: T }}>{s.name}</div>
                    <div className="flex gap-2.5 mt-0.5">
                      <span className="text-[11px]" style={{ color: S }}>{s.count} barril{s.count !== 1 ? "es" : ""}</span>
                      <span className="text-[11px]" style={{ color: S }}>{s.totalLiters}L vendidos</span>
                      <span className="text-[11px]" style={{ color: S }}>{s.totalMermaL}L merma</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-lg font-bold" style={{ color: yColor(s.avgYield) }}>{s.avgYield}%</div>
                    <div className="text-[10px]" style={{ color: M }}>promedio</div>
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        {totalBarrels === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No hay barriles cerrados en este período
          </div>
        )}
      </div>
    </div>
  );
}
