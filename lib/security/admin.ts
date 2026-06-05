import type { NextRequest } from "next/server";

export type ProtectedRouteKind = "admin" | "cron" | "ops";

export function hasSharedSecret(request: NextRequest, secrets: Array<string | undefined>): boolean {
  const provided =
    request.headers.get("x-pour-admin-secret") ??
    request.headers.get("x-sync-cron-secret") ??
    request.headers.get("x-dev-sync-secret") ??
    request.nextUrl.searchParams.get("secret");

  return Boolean(provided && secrets.some((secret) => secret && secret === provided));
}

export function isSameOriginRequest(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "same-origin" || fetchSite === "same-site") return true;
  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isProtectedRouteAllowed(request: NextRequest, kind: ProtectedRouteKind): boolean {
  if (process.env.NODE_ENV !== "production") return true;

  const adminSecrets = [
    process.env.POUR_ADMIN_SECRET,
    process.env.PILOT_ADMIN_SECRET,
  ];

  if (kind === "cron") {
    return hasSharedSecret(request, [...adminSecrets, process.env.SYNC_CRON_SECRET]);
  }

  if (kind === "ops" && isSameOriginRequest(request)) {
    return true;
  }

  return hasSharedSecret(request, [
    ...adminSecrets,
    process.env.DEV_SYNC_SECRET,
    process.env.SYNC_CRON_SECRET,
  ]);
}
