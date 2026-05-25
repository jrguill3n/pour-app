"use client";

import type { Line, Barrel } from "@/lib/pour-data";
import { remPct, yPct, yColor, fmtL } from "@/lib/pour-utils";
import { LevelBar } from "./pour-logo";

interface LineCardProps {
  line: Line;
  barrel: Barrel | undefined;
  isSelected: boolean;
  onClick: () => void;
  darkMode?: boolean;
}

export function LineCard({
  line,
  barrel,
  isSelected,
  onClick,
  darkMode = false,
}: LineCardProps) {
  const isEmpty = !barrel;
  const totalMl = barrel ? barrel.volumeL * 1000 : 0;
  const rPct = barrel ? remPct(barrel.mlConsumed, totalMl) : 0;
  const consumed = barrel ? parseFloat(yPct(barrel.mlConsumed, totalMl)) : 0;
  const color = barrel ? yColor(consumed) : "#9ca3af";
  const isLow = barrel && rPct < 20;
  const isAlmostEmpty = barrel && rPct < 8;

  return (
    <div
      onClick={onClick}
      className="rounded-lg p-3 cursor-pointer transition-all min-h-[108px] flex flex-col gap-2"
      style={{
        background: isSelected
          ? darkMode
            ? "#1c2030"
            : "#fff"
          : darkMode
          ? "#151820"
          : "#fafaf9",
        border: `1.5px solid ${
          isSelected
            ? "#f43f5e"
            : isEmpty
            ? darkMode
              ? "#1c2030"
              : "#e5e7eb"
            : isAlmostEmpty
            ? "#fca5a5"
            : isLow
            ? "#fde68a"
            : darkMode
            ? "#2a3050"
            : "#e5e7eb"
        }`,
        boxShadow: isSelected ? "0 0 0 3px #f43f5e18" : "none",
      }}
    >
      <div className="flex justify-between items-center">
        <div
          className="font-mono text-xs font-semibold"
          style={{
            color: isSelected ? "#f43f5e" : darkMode ? "#2a3050" : "#9ca3af",
          }}
        >
          {String(line.id).padStart(2, "0")}
        </div>
        {line.note ? (
          <div className="text-[8px] tracking-wide uppercase bg-purple-100 text-purple-600 rounded px-1.5 py-0.5">
            {line.note}
          </div>
        ) : (
          !isEmpty && (
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: isAlmostEmpty
                  ? "#dc2626"
                  : isLow
                  ? "#d97706"
                  : "#16a34a",
              }}
            />
          )
        )}
      </div>
      {isEmpty ? (
        <div
          className="flex-1 flex items-center justify-center text-xl"
          style={{ color: darkMode ? "#1c2030" : "#d1d5db" }}
        >
          +
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-1">
          {barrel.brand && (
            <div
              className="text-[9px] overflow-hidden text-ellipsis whitespace-nowrap"
              style={{ color: darkMode ? "#2a3050" : "#9ca3af" }}
            >
              {[barrel.brand, barrel.abv ? `${barrel.abv}%` : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
          <div
            className="text-[11px] font-semibold overflow-hidden text-ellipsis whitespace-nowrap leading-tight"
            style={{ color: darkMode ? "#e2e8f0" : "#111827" }}
          >
            {barrel.group}
          </div>
          <div className="mt-auto">
            <LevelBar pct={rPct} color={color} />
            <div className="flex justify-between mt-1">
              <span
                className="text-[9px]"
                style={{ color: darkMode ? "#2a3050" : "#9ca3af" }}
              >
                {fmtL(totalMl - barrel.mlConsumed)}
              </span>
              <span
                className="font-mono text-[10px] font-bold"
                style={{ color }}
              >
                {Math.round(rPct)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
