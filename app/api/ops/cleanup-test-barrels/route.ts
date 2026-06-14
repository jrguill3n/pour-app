import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/client";
import * as pg from "@/lib/db/schema/postgres";
import * as sqlite from "@/lib/db/schema/sqlite";
import { getOperationalSnapshot } from "@/lib/db/repositories/operations";
import { isProtectedRouteAllowed } from "@/lib/security/admin";

const TEST_BARRELS = [
  {
    id: "poster:624548:barrel:1:1781453298835",
    merchantId: "624548",
    posProvider: "poster",
    lineId: 1,
    brand: "Smoke Test Edited",
    groupName: "PINTA FROGGY",
    openedBy: "Smoke Test edited 2026-06-14",
    status: "closed",
  },
  {
    id: "poster:624548:barrel:1:1781152815150",
    merchantId: "624548",
    posProvider: "poster",
    lineId: 1,
    brand: "Insurgente",
    groupName: "PINTA FROGGY",
    openedBy: "Codex verification",
    status: "closed",
  },
] as const;

function matchesTarget(
  row: {
    id: string;
    merchantId: string;
    posProvider: string;
    lineId: number;
    brand: string | null;
    groupName: string | null;
    openedBy: string | null;
    status: string;
  } | undefined,
  target: (typeof TEST_BARRELS)[number]
) {
  return Boolean(
    row &&
      row.id === target.id &&
      row.merchantId === target.merchantId &&
      row.posProvider === target.posProvider &&
      row.lineId === target.lineId &&
      row.brand === target.brand &&
      row.groupName === target.groupName &&
      row.openedBy === target.openedBy &&
      row.status === target.status
  );
}

export async function POST(request: NextRequest) {
  if (!isProtectedRouteAllowed(request, "ops")) {
    return NextResponse.json({ ok: false, error: "Cleanup is not authorized." }, { status: 403 });
  }

  const runtime = getDatabase();
  const removed: typeof TEST_BARRELS[number][] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const target of TEST_BARRELS) {
    if (runtime.dialect === "postgres") {
      const rows = await runtime.db
        .select()
        .from(pg.barrels)
        .where(
          and(
            eq(pg.barrels.id, target.id),
            eq(pg.barrels.merchantId, target.merchantId),
            eq(pg.barrels.posProvider, target.posProvider)
          )
        )
        .limit(1);
      const row = rows[0];

      if (!matchesTarget(row, target)) {
        skipped.push({ id: target.id, reason: row ? "metadata_mismatch" : "not_found" });
        continue;
      }

      await runtime.db
        .delete(pg.barrels)
        .where(
          and(
            eq(pg.barrels.id, target.id),
            eq(pg.barrels.merchantId, target.merchantId),
            eq(pg.barrels.posProvider, target.posProvider)
          )
        );
      removed.push(target);
      continue;
    }

    const rows = await runtime.db
      .select()
      .from(sqlite.barrels)
      .where(
        and(
          eq(sqlite.barrels.id, target.id),
          eq(sqlite.barrels.merchantId, target.merchantId),
          eq(sqlite.barrels.posProvider, target.posProvider)
        )
      )
      .limit(1);
    const row = rows[0];

    if (!matchesTarget(row, target)) {
      skipped.push({ id: target.id, reason: row ? "metadata_mismatch" : "not_found" });
      continue;
    }

    await runtime.db
      .delete(sqlite.barrels)
      .where(
        and(
          eq(sqlite.barrels.id, target.id),
          eq(sqlite.barrels.merchantId, target.merchantId),
          eq(sqlite.barrels.posProvider, target.posProvider)
        )
      );
    removed.push(target);
  }

  const snapshot = await getOperationalSnapshot("poster");
  return NextResponse.json({ ok: true, removed, skipped, snapshot });
}
