"use client";

import { useEffect, useState, useMemo } from "react";
import type { Product } from "@/lib/core/types";

interface ProductSelectorProps {
  products: Product[];
  selected: string[];
  onChange: (ids: string[]) => void;
  darkMode?: boolean;
}

export function ProductSelector({
  products,
  selected,
  onChange,
  darkMode = false,
}: ProductSelectorProps) {
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");

  useEffect(() => {
    console.info("Create Keg product selector diagnostics.", {
      productsReturnedToSelector: products.length,
    });
  }, [products.length]);

  const brands = useMemo(
    () => ["all", ...new Set(products.map((p) => p.brand))],
    [products]
  );

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const matchBrand = brandFilter === "all" || p.brand === brandFilter;
        const q = search.toLowerCase();
        return (
          matchBrand &&
          (!q ||
            p.brand.toLowerCase().includes(q) ||
            p.variant.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q))
        );
      }),
    [products, search, brandFilter]
  );

  const grouped = useMemo(() => {
    const map: Record<string, Product[]> = {};
    filtered.forEach((p) => {
      if (!map[p.brand]) map[p.brand] = [];
      map[p.brand].push(p);
    });
    return map;
  }, [filtered]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1.5px solid ${darkMode ? "#2a3050" : "#e5e7eb"}`,
        background: darkMode ? "#151820" : "#fff",
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{
          borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
        }}
      >
        <span className="text-muted-foreground text-sm">🔍</span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar marca o estilo..."
          className="flex-1 border-none outline-none text-sm bg-transparent"
          style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        )}
      </div>
      <div
        className="flex gap-1 px-3 py-2 overflow-x-auto"
        style={{
          borderBottom: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
        }}
      >
        {brands.map((b) => (
          <button
            key={b}
            onClick={() => setBrandFilter(b)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              background:
                brandFilter === b
                  ? "#111827"
                  : darkMode
                  ? "#1c2030"
                  : "#f3f4f6",
              color:
                brandFilter === b ? "#fff" : darkMode ? "#475569" : "#6b7280",
            }}
          >
            {b === "all" ? "Todos" : b}
          </button>
        ))}
      </div>
      <div
        className="max-h-[200px] overflow-y-auto"
        style={{ background: darkMode ? "#151820" : "#fff" }}
      >
        {Object.keys(grouped).length === 0 ? (
          <div
            className="p-5 text-center text-sm"
            style={{ color: darkMode ? "#2a3050" : "#9ca3af" }}
          >
            Sin resultados
          </div>
        ) : (
          Object.entries(grouped).map(([brand, prods]) => (
            <div key={brand}>
              <div
                className="px-3 py-1 text-[10px] tracking-wider uppercase font-medium"
                style={{
                  color: darkMode ? "#2a3050" : "#9ca3af",
                  background: darkMode ? "#0f1117" : "#fafafa",
                  borderBottom: `1px solid ${darkMode ? "#1c2030" : "#f9fafb"}`,
                }}
              >
                {brand}
              </div>
              {prods.map((p, i) => {
                const checked = selected.includes(p.external_product_id);
                return (
                  <div
                    key={p.id}
                    onClick={() =>
                      onChange(
                        checked
                          ? selected.filter((x) => x !== p.external_product_id)
                          : [...selected, p.external_product_id]
                      )
                    }
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors"
                    style={{
                      background: checked ? "#fff1f2" : "#fff",
                      borderBottom:
                        i < prods.length - 1 ? "1px solid #f9fafb" : "none",
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center"
                      style={{
                        border: `1.5px solid ${
                          checked ? "#f43f5e" : "#d1d5db"
                        }`,
                        background: checked ? "#f43f5e" : "#fff",
                      }}
                    >
                      {checked && (
                        <span className="text-white text-[10px]">✓</span>
                      )}
                    </div>
                    <div
                      className="flex-1 text-sm overflow-hidden text-ellipsis whitespace-nowrap"
                      style={{
                        color: darkMode ? "#e2e8f0" : "#111827",
                        fontWeight: checked ? 500 : 400,
                      }}
                    >
                      {p.variant}
                    </div>
                    <div
                      className="text-xs font-mono shrink-0"
                      style={{ color: darkMode ? "#475569" : "#9ca3af" }}
                    >
                      {p.cupMl}ml
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
      {selected.length > 0 && (
        <div
          className="flex justify-between px-3 py-2"
          style={{
            borderTop: `1px solid ${darkMode ? "#2a3050" : "#f3f4f6"}`,
            background: darkMode ? "#0f1117" : "#fafafa",
          }}
        >
          <span
            className="text-xs"
            style={{ color: darkMode ? "#475569" : "#6b7280" }}
          >
            {selected.length} seleccionado{selected.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => onChange([])}
            className="text-xs"
            style={{ color: darkMode ? "#2a3050" : "#9ca3af" }}
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  );
}
