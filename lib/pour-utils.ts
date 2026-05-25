export function remPct(consumed: number, total: number): number {
  return Math.max(0, Math.min(100, 100 - (consumed / total) * 100));
}

export function yPct(consumed: number, total: number): string {
  return ((consumed / total) * 100).toFixed(1);
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
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`;
}
