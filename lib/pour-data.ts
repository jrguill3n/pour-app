import type { BarConfig, Barrel, Line, MenuConfig, Product, Template } from "@/lib/core/types";

export type { BarConfig, Barrel, Line, MenuConfig, Product, Template };

export const EMPLOYEES = ["Carlos V.", "María R.", "Luis T.", "Ana P."];

const mockProduct = (numeric_id: number, brand: string, variant: string, cupMl: number): Product => ({
  id: numeric_id,
  external_product_id: String(numeric_id),
  pos_provider: "mock",
  name: variant,
  brand,
  variant,
  cupMl,
  cup_ml: cupMl,
  price_cents: null,
});

export const PRODUCTS: Product[] = [
  mockProduct(1, "Hercules", "Hombre Pájaro — Sampler", 150),
  mockProduct(2, "Hercules", "Hombre Pájaro — Vaso", 355),
  mockProduct(3, "Hercules", "Hombre Pájaro — Jarra", 1000),
  mockProduct(4, "Hercules", "Golden Ale — Vaso", 355),
  mockProduct(5, "Hercules", "Golden Ale — Jarra", 1000),
  mockProduct(6, "Hercules", "Stout Oscura — Sampler", 150),
  mockProduct(7, "Hercules", "Stout Oscura — Vaso", 355),
  mockProduct(8, "Cantina RoRo", "Stout Nocturna — Sampler", 150),
  mockProduct(9, "Cantina RoRo", "Stout Nocturna — Vaso", 355),
  mockProduct(10, "Cantina RoRo", "Stout Nocturna — Jarra", 1000),
  mockProduct(11, "Wendlandt", "Lobo del Mar — Vaso", 355),
  mockProduct(12, "Wendlandt", "Lobo del Mar — Jarra", 1000),
  mockProduct(13, "Wendlandt", "Expat — Vaso", 355),
  mockProduct(14, "Lúpulo Norte", "IPA Salvaje — Sampler", 150),
  mockProduct(15, "Lúpulo Norte", "IPA Salvaje — Vaso", 355),
  mockProduct(16, "Falling Piano", "Dinamita Imperial — Sampler", 150),
  mockProduct(17, "Falling Piano", "Dinamita Imperial — Vaso", 355),
  mockProduct(18, "Monstruo de Agua", "Ajolote Pale — Vaso", 355),
  mockProduct(19, "Monstruo de Agua", "Ajolote Pale — Jarra", 1000),
  mockProduct(20, "Colima Beer", "Pale Ale — Vaso", 355),
  mockProduct(21, "Colima Beer", "Pale Ale — Jarra", 1000),
];

export const INITIAL_LINES: Line[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  note: i + 1 === 15 ? "Nitro" : "",
}));

export const INITIAL_TEMPLATES: Template[] = [
  { id: 1, brand: "Hercules", group: "Hombre Pájaro", external_product_ids: ["1", "2", "3"], volumeL: 20, lastPrice: 1800, timesUsed: 8, pos_provider: "mock" },
  { id: 2, brand: "Cantina RoRo", group: "Stout Nocturna", external_product_ids: ["8", "9", "10"], volumeL: 20, lastPrice: 2100, timesUsed: 5, pos_provider: "mock" },
  { id: 3, brand: "Wendlandt", group: "Lobo del Mar", external_product_ids: ["11", "12"], volumeL: 20, lastPrice: 1950, timesUsed: 6, pos_provider: "mock" },
  { id: 4, brand: "Lúpulo Norte", group: "IPA Salvaje", external_product_ids: ["14", "15"], volumeL: 20, lastPrice: 1700, timesUsed: 4, pos_provider: "mock" },
  { id: 5, brand: "Hercules", group: "Golden Ale", external_product_ids: ["4", "5"], volumeL: 30, lastPrice: 2600, timesUsed: 3, pos_provider: "mock" },
];

export const INITIAL_BARRELS: Barrel[] = [
  { id: 1, pos_provider: "mock", location_id: null, revenueBrutoCents: 284000, revenueDescuentosCents: 34000, revenueNetoCents: 250000, kegId: "KEG-2026-000001", lineId: 1, brand: "Hercules", group: "Hombre Pájaro", beerStyle: "IPA", abv: 6.5, external_product_ids: ["1", "2", "3"], volumeL: 20, pricePaid: 1800, openedAt: "2026-04-30T10:15:00", openedBy: "Carlos V.", status: "active", mlConsumed: 8400, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 2, pos_provider: "mock", location_id: null, revenueBrutoCents: 342000, revenueDescuentosCents: 0, revenueNetoCents: 342000, kegId: "KEG-2026-000002", lineId: 2, brand: "Cantina RoRo", group: "Stout Nocturna", beerStyle: "Stout", abv: 8.2, external_product_ids: ["8", "9", "10"], volumeL: 20, pricePaid: 2100, openedAt: "2026-04-29T18:00:00", openedBy: "María R.", status: "active", mlConsumed: 17500, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 3, pos_provider: "mock", location_id: null, revenueBrutoCents: 296000, revenueDescuentosCents: 0, revenueNetoCents: 296000, kegId: "KEG-2026-000003", lineId: 4, brand: "Wendlandt", group: "Lobo del Mar", beerStyle: "Pale Ale", abv: 5.2, external_product_ids: ["11", "12"], volumeL: 20, pricePaid: 1950, openedAt: "2026-04-28T11:00:00", openedBy: "Luis T.", status: "active", mlConsumed: 14200, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 4, pos_provider: "mock", location_id: null, revenueBrutoCents: 198000, revenueDescuentosCents: 28000, revenueNetoCents: 170000, kegId: "KEG-2026-000004", lineId: 5, brand: "Lúpulo Norte", group: "IPA Salvaje", beerStyle: "IPA", abv: 7.1, external_product_ids: ["14", "15"], volumeL: 20, pricePaid: 1700, openedAt: "2026-04-27T09:00:00", openedBy: "María R.", status: "active", mlConsumed: 12800, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 5, pos_provider: "mock", location_id: null, revenueBrutoCents: 264000, revenueDescuentosCents: 0, revenueNetoCents: 264000, kegId: "KEG-2026-000005", lineId: 7, brand: "Hercules", group: "Golden Ale", beerStyle: "Golden Ale", abv: 4.8, external_product_ids: ["4", "5"], volumeL: 30, pricePaid: 2600, openedAt: "2026-04-26T10:00:00", openedBy: "Carlos V.", status: "active", mlConsumed: 12000, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 6, pos_provider: "mock", location_id: null, revenueBrutoCents: 182000, revenueDescuentosCents: 0, revenueNetoCents: 182000, kegId: "KEG-2026-000006", lineId: 10, brand: "Falling Piano", group: "Dinamita Imperial", beerStyle: "Imperial Stout", abv: 11.0, external_product_ids: ["16", "17"], volumeL: 20, pricePaid: 2200, openedAt: "2026-04-25T14:00:00", openedBy: "Ana P.", status: "active", mlConsumed: 9600, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 7, pos_provider: "mock", location_id: null, revenueBrutoCents: 210000, revenueDescuentosCents: 0, revenueNetoCents: 210000, kegId: "KEG-2026-000007", lineId: 15, brand: "Monstruo de Agua", group: "Ajolote Pale (Nitro)", beerStyle: "Pale Ale", abv: 5.5, external_product_ids: ["18", "19"], volumeL: 20, pricePaid: 2000, openedAt: "2026-04-24T10:00:00", openedBy: "Luis T.", status: "active", mlConsumed: 11200, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 8, pos_provider: "mock", location_id: null, revenueBrutoCents: 320000, revenueDescuentosCents: 42000, revenueNetoCents: 278000, kegId: "KEG-2026-000008", lineId: 3, brand: "Hercules", group: "Golden Ale", beerStyle: "Golden Ale", abv: 4.8, external_product_ids: ["4", "5"], volumeL: 20, pricePaid: 2400, openedAt: "2026-04-20T10:00:00", openedBy: "Carlos V.", status: "closed", mlConsumed: 17200, mermaMl: 2400, closedAt: "2026-04-25T22:00:00", closedBy: "Carlos V." },
  { id: 9, pos_provider: "mock", location_id: null, revenueBrutoCents: 364000, revenueDescuentosCents: 0, revenueNetoCents: 364000, kegId: "KEG-2026-000009", lineId: 6, brand: "Lúpulo Norte", group: "IPA Salvaje", beerStyle: "IPA", abv: 7.1, external_product_ids: ["14", "15"], volumeL: 20, pricePaid: 1700, openedAt: "2026-04-18T09:00:00", openedBy: "María R.", status: "closed", mlConsumed: 18800, mermaMl: 1200, closedAt: "2026-04-24T23:00:00", closedBy: "Luis T." },
];

export const INITIAL_BAR_CONFIG: BarConfig = {
  maxMermaPct: 8,
  pricePerMl: 0.2,
};

export const INITIAL_MENU_CONFIG: MenuConfig = {
  template: "blackboard",
  font: "ibm",
  fontSub: "ibm",
  barName: "Mi Cervecería",
  logoUrl: null,
  columns: 2,
  orientation: "landscape",
  cardSize: 4,
  groupBy: "none",
  groupLabel: "",
  showBrand: true,
  showBeerStyle: true,
  showABV: true,
  showLevel: false,
  showLineNumber: false,
  showFormats: true,
  showPrices: true,
  listFontSize: 4,
  cardStyle: "accent",
  customBg: null,
  customAccent: null,
  customText: null,
  customSub: null,
  customCardAccent: null,
};
