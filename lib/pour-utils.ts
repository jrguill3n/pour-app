import { formatLiters, getRemainingPct, getYieldPct } from "@/lib/core/consumption";

export function remPct(consumed: number, total: number): number {
  return getRemainingPct(consumed, total);
}

export function yPct(consumed: number, total: number): string {
  return getYieldPct(consumed, total);
}

export function yColor(p: number | string): string {
  const v = typeof p === 'string' ? parseFloat(p) : p;
  return v >= 95 ? "#16a34a" : v >= 75 ? "#d97706" : "#dc2626";
}

export function yBg(p: number | string): string {
  const v = typeof p === 'string' ? parseFloat(p) : p;
  return v >= 95 ? "#f0fdf4" : v >= 75 ? "#fffbeb" : "#fef2f2";
}

export function yBorder(p: number | string): string {
  const v = typeof p === 'string' ? parseFloat(p) : p;
  return v >= 95 ? "#bbf7d0" : v >= 75 ? "#fde68a" : "#fecaca";
}

export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtL(ml: number): string {
  return formatLiters(ml);
}
