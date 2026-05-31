import {
  EMPLOYEES,
  INITIAL_BAR_CONFIG,
  INITIAL_BARRELS,
  INITIAL_LINES,
  INITIAL_MENU_CONFIG,
  INITIAL_TEMPLATES,
  PRODUCTS,
} from "@/lib/pour-data";
import type { BarConfig, Barrel, Line, MenuConfig, Product, Template } from "@/lib/core/types";

export interface KegBoardInitialState {
  products: Product[];
  employees: string[];
  lines: Line[];
  templates: Template[];
  barrels: Barrel[];
  barConfig: BarConfig;
  menuConfig: MenuConfig;
}

export function getKegBoardInitialState(): KegBoardInitialState {
  return {
    products: PRODUCTS,
    employees: EMPLOYEES,
    lines: INITIAL_LINES,
    templates: INITIAL_TEMPLATES,
    barrels: INITIAL_BARRELS,
    barConfig: INITIAL_BAR_CONFIG,
    menuConfig: INITIAL_MENU_CONFIG,
  };
}
