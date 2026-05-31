import type {
  NormalizedEmployee,
  NormalizedLocation,
  NormalizedProduct,
  NormalizedSale,
  POSProvider,
} from "@/lib/pos/types";

export type { NormalizedEmployee, NormalizedLocation, NormalizedProduct, NormalizedSale, POSProvider };

export interface Product extends Omit<NormalizedProduct, "id"> {
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
  external_product_ids: string[];
  productIds?: number[];
  volumeL: number;
  lastPrice: number;
  timesUsed: number;
  pos_provider: POSProvider;
}

export interface Barrel {
  id: number;
  kegId: string;
  location_id: string | null;
  lineId: number;
  brand: string;
  group: string;
  beerStyle: string;
  abv: number | null;
  external_product_ids: string[];
  productIds?: number[];
  pos_provider: POSProvider;
  volumeL: number;
  pricePaid: number;
  openedAt: string;
  openedBy: string;
  status: "active" | "closed";
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
  orientation: "landscape" | "portrait";
  cardSize: number;
  groupBy: "none" | "brand" | "beerStyle" | "lineId";
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
