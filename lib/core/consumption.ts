export function getTotalMl(volumeL: number): number {
  return volumeL * 1000;
}

export function getRemainingPct(consumedMl: number, totalMl: number): number {
  if (totalMl <= 0) return 0;
  return Math.max(0, Math.min(100, 100 - (consumedMl / totalMl) * 100));
}

export function getConsumedPct(consumedMl: number, totalMl: number): number {
  if (totalMl <= 0) return 0;
  return Math.max(0, Math.min(100, (consumedMl / totalMl) * 100));
}

export function getYieldPct(consumedMl: number, totalMl: number): string {
  return getConsumedPct(consumedMl, totalMl).toFixed(1);
}

export function getExcessMermaMl(mermaMl: number, volumeL: number, maxMermaPct: number): number {
  const allowedMermaMl = (maxMermaPct / 100) * getTotalMl(volumeL);
  return Math.max(0, mermaMl - allowedMermaMl);
}

export function formatLiters(ml: number): string {
  return ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`;
}
