import { NextRequest, NextResponse } from "next/server";
import { getOperationalSnapshot } from "@/lib/db/repositories/operations";
import type { POSProvider } from "@/lib/pos/types";

export async function GET(request: NextRequest) {
  const provider = request.nextUrl.searchParams.get("provider") as POSProvider | null;
  const snapshot = await getOperationalSnapshot(provider ?? undefined);

  return NextResponse.json({ ok: true, snapshot });
}
