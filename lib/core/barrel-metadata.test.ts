import { describe, expect, it } from "vitest";
import { formatBarrelMetadata } from "./barrel-metadata";

describe("formatBarrelMetadata", () => {
  it("formats metadata from the persisted barrel row values", () => {
    expect(
      formatBarrelMetadata({
        openedBy: "Ramon",
        pricePaidCents: 180000,
        volumeMl: 20000,
      })
    ).toEqual({
      openedBy: "Ramon",
      kegCost: "$1,800",
      initialVolume: "20L",
    });
  });

  it("formats edited barrel cost and volume from persisted cents and ml", () => {
    expect(
      formatBarrelMetadata({
        openedBy: "Ana",
        pricePaidCents: 301800,
        volumeMl: 30000,
      })
    ).toEqual({
      openedBy: "Ana",
      kegCost: "$3,018",
      initialVolume: "30L",
    });
  });

  it("shows No registrado when persisted metadata is missing", () => {
    expect(formatBarrelMetadata({})).toEqual({
      openedBy: "No registrado",
      kegCost: "No registrado",
      initialVolume: "No registrado",
    });
  });
});
