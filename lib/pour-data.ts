export interface Product {
  id: number;
  brand: string;
  variant: string;
  cupMl: number;
}

export interface Line {
  id: number;
  note: string;
}

export interface Template {
  id: number;
  brand: string;
  group: string;
  productIds: number[];
  volumeL: number;
  lastPrice: number;
  timesUsed: number;
}

export interface Barrel {
  id: number;
  kegId: string;
  lineId: number;
  brand: string;
  group: string;
  beerStyle: string;
  abv: number | null;
  productIds: number[];
  volumeL: number;
  pricePaid: number;
  openedAt: string;
  openedBy: string;
  status: 'active' | 'closed';
  mlConsumed: number;
  mermaMl: number;
  closedAt: string | null;
  closedBy: string | null;
  editedAt?: string;
  editedBy?: string;
  voided?: boolean;
  revenueBrutoCents?: number;
  revenueDescuentosCents?: number;
  revenueNetoCents?: number;
}

export interface BarConfig {
  maxMermaPct: number;
  pricePerMl: number;
}

export interface MenuConfig {
  template: string;
  font: string;
  fontSub: string;
  barName: string;
  tagline?: string;
  logoUrl: string | null;
  columns: number;
  orientation: 'landscape' | 'portrait';
  cardSize: number;
  groupBy: 'none' | 'brand' | 'beerStyle' | 'lineId';
  groupLabel: string;
  showBrand: boolean;
  showBeerStyle: boolean;
  showABV: boolean;
  showLevel: boolean;
  showLineNumber: boolean;
  showFormats: boolean;
  showPrices: boolean;
  listFontSize: number;
  cardStyle: string;
  customBg: string | null;
  customAccent: string | null;
  customText: string | null;
  customSub: string | null;
  customCardAccent: string | null;
}

export const EMPLOYEES = ["Carlos V.", "María R.", "Luis T.", "Ana P."];

export const PRODUCTS: Product[] = [
  { id: 1, brand: "Hercules", variant: "Hombre Pájaro — Sampler", cupMl: 150 },
  { id: 2, brand: "Hercules", variant: "Hombre Pájaro — Vaso", cupMl: 355 },
  { id: 3, brand: "Hercules", variant: "Hombre Pájaro — Jarra", cupMl: 1000 },
  { id: 4, brand: "Hercules", variant: "Golden Ale — Vaso", cupMl: 355 },
  { id: 5, brand: "Hercules", variant: "Golden Ale — Jarra", cupMl: 1000 },
  { id: 6, brand: "Hercules", variant: "Stout Oscura — Sampler", cupMl: 150 },
  { id: 7, brand: "Hercules", variant: "Stout Oscura — Vaso", cupMl: 355 },
  { id: 8, brand: "Cantina RoRo", variant: "Stout Nocturna — Sampler", cupMl: 150 },
  { id: 9, brand: "Cantina RoRo", variant: "Stout Nocturna — Vaso", cupMl: 355 },
  { id: 10, brand: "Cantina RoRo", variant: "Stout Nocturna — Jarra", cupMl: 1000 },
  { id: 11, brand: "Wendlandt", variant: "Lobo del Mar — Vaso", cupMl: 355 },
  { id: 12, brand: "Wendlandt", variant: "Lobo del Mar — Jarra", cupMl: 1000 },
  { id: 13, brand: "Wendlandt", variant: "Expat — Vaso", cupMl: 355 },
  { id: 14, brand: "Lúpulo Norte", variant: "IPA Salvaje — Sampler", cupMl: 150 },
  { id: 15, brand: "Lúpulo Norte", variant: "IPA Salvaje — Vaso", cupMl: 355 },
  { id: 16, brand: "Falling Piano", variant: "Dinamita Imperial — Sampler", cupMl: 150 },
  { id: 17, brand: "Falling Piano", variant: "Dinamita Imperial — Vaso", cupMl: 355 },
  { id: 18, brand: "Monstruo de Agua", variant: "Ajolote Pale — Vaso", cupMl: 355 },
  { id: 19, brand: "Monstruo de Agua", variant: "Ajolote Pale — Jarra", cupMl: 1000 },
  { id: 20, brand: "Colima Beer", variant: "Pale Ale — Vaso", cupMl: 355 },
  { id: 21, brand: "Colima Beer", variant: "Pale Ale — Jarra", cupMl: 1000 },
];

export const INITIAL_LINES: Line[] = Array.from({ length: 15 }, (_, i) => ({
  id: i + 1,
  note: i + 1 === 15 ? "Nitro" : "",
}));

export const INITIAL_TEMPLATES: Template[] = [
  { id: 1, brand: "Hercules", group: "Hombre Pájaro", productIds: [1, 2, 3], volumeL: 20, lastPrice: 1800, timesUsed: 8 },
  { id: 2, brand: "Cantina RoRo", group: "Stout Nocturna", productIds: [8, 9, 10], volumeL: 20, lastPrice: 2100, timesUsed: 5 },
  { id: 3, brand: "Wendlandt", group: "Lobo del Mar", productIds: [11, 12], volumeL: 20, lastPrice: 1950, timesUsed: 6 },
  { id: 4, brand: "Lúpulo Norte", group: "IPA Salvaje", productIds: [14, 15], volumeL: 20, lastPrice: 1700, timesUsed: 4 },
  { id: 5, brand: "Hercules", group: "Golden Ale", productIds: [4, 5], volumeL: 30, lastPrice: 2600, timesUsed: 3 },
];

export const INITIAL_BARRELS: Barrel[] = [
  { id: 1, revenueBrutoCents: 284000, revenueDescuentosCents: 34000, revenueNetoCents: 250000, kegId: "KEG-2026-000001", lineId: 1, brand: "Hercules", group: "Hombre Pájaro", beerStyle: "IPA", abv: 6.5, productIds: [1, 2, 3], volumeL: 20, pricePaid: 1800, openedAt: "2026-04-30T10:15:00", openedBy: "Carlos V.", status: "active", mlConsumed: 8400, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 2, revenueBrutoCents: 342000, revenueDescuentosCents: 0, revenueNetoCents: 342000, kegId: "KEG-2026-000002", lineId: 2, brand: "Cantina RoRo", group: "Stout Nocturna", beerStyle: "Stout", abv: 8.2, productIds: [8, 9, 10], volumeL: 20, pricePaid: 2100, openedAt: "2026-04-29T18:00:00", openedBy: "María R.", status: "active", mlConsumed: 17500, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 3, revenueBrutoCents: 296000, revenueDescuentosCents: 0, revenueNetoCents: 296000, kegId: "KEG-2026-000003", lineId: 4, brand: "Wendlandt", group: "Lobo del Mar", beerStyle: "Pale Ale", abv: 5.2, productIds: [11, 12], volumeL: 20, pricePaid: 1950, openedAt: "2026-04-28T11:00:00", openedBy: "Luis T.", status: "active", mlConsumed: 14200, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 4, revenueBrutoCents: 198000, revenueDescuentosCents: 28000, revenueNetoCents: 170000, kegId: "KEG-2026-000004", lineId: 5, brand: "Lúpulo Norte", group: "IPA Salvaje", beerStyle: "IPA", abv: 7.1, productIds: [14, 15], volumeL: 20, pricePaid: 1700, openedAt: "2026-04-27T09:00:00", openedBy: "María R.", status: "active", mlConsumed: 12800, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 5, revenueBrutoCents: 264000, revenueDescuentosCents: 0, revenueNetoCents: 264000, kegId: "KEG-2026-000005", lineId: 7, brand: "Hercules", group: "Golden Ale", beerStyle: "Golden Ale", abv: 4.8, productIds: [4, 5], volumeL: 30, pricePaid: 2600, openedAt: "2026-04-26T10:00:00", openedBy: "Carlos V.", status: "active", mlConsumed: 12000, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 6, revenueBrutoCents: 182000, revenueDescuentosCents: 0, revenueNetoCents: 182000, kegId: "KEG-2026-000006", lineId: 10, brand: "Falling Piano", group: "Dinamita Imperial", beerStyle: "Imperial Stout", abv: 11.0, productIds: [16, 17], volumeL: 20, pricePaid: 2200, openedAt: "2026-04-25T14:00:00", openedBy: "Ana P.", status: "active", mlConsumed: 9600, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 7, revenueBrutoCents: 210000, revenueDescuentosCents: 0, revenueNetoCents: 210000, kegId: "KEG-2026-000007", lineId: 15, brand: "Monstruo de Agua", group: "Ajolote Pale (Nitro)", beerStyle: "Pale Ale", abv: 5.5, productIds: [18, 19], volumeL: 20, pricePaid: 2000, openedAt: "2026-04-24T10:00:00", openedBy: "Luis T.", status: "active", mlConsumed: 11200, mermaMl: 0, closedAt: null, closedBy: null },
  { id: 8, revenueBrutoCents: 320000, revenueDescuentosCents: 42000, revenueNetoCents: 278000, kegId: "KEG-2026-000008", lineId: 3, brand: "Hercules", group: "Golden Ale", beerStyle: "Golden Ale", abv: 4.8, productIds: [4, 5], volumeL: 20, pricePaid: 2400, openedAt: "2026-04-20T10:00:00", openedBy: "Carlos V.", status: "closed", mlConsumed: 17200, mermaMl: 2400, closedAt: "2026-04-25T22:00:00", closedBy: "Carlos V." },
  { id: 9, revenueBrutoCents: 364000, revenueDescuentosCents: 0, revenueNetoCents: 364000, kegId: "KEG-2026-000009", lineId: 6, brand: "Lúpulo Norte", group: "IPA Salvaje", beerStyle: "IPA", abv: 7.1, productIds: [14, 15], volumeL: 20, pricePaid: 1700, openedAt: "2026-04-18T09:00:00", openedBy: "María R.", status: "closed", mlConsumed: 18800, mermaMl: 1200, closedAt: "2026-04-24T23:00:00", closedBy: "Luis T." },
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
