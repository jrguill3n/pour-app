interface BarrelMetadataInput {
  openedBy?: string | null;
  pricePaidCents?: number | null;
  volumeMl?: number | null;
}

const missing = "No registrado";

export function formatBarrelMetadata(input: BarrelMetadataInput) {
  const openedBy = input.openedBy?.trim() || missing;
  const pricePaidCents = input.pricePaidCents;
  const volumeMl = input.volumeMl;

  return {
    openedBy,
    kegCost:
      typeof pricePaidCents === "number" && Number.isFinite(pricePaidCents)
        ? `$${(pricePaidCents / 100).toLocaleString()}`
        : missing,
    initialVolume:
      typeof volumeMl === "number" && Number.isFinite(volumeMl) && volumeMl > 0
        ? `${volumeMl / 1000}L`
        : missing,
  };
}
