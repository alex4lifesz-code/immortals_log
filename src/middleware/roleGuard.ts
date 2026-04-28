// src/middleware/roleGuard.ts — Enforce role-based access on specific dashboard routes

import { NextResponse } from "next/server";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import type { MiddlewareContext } from "./types";
import { isDashboardRoute } from "./routeClassifier";

/** Dashboard paths that require role === "admin" */
const ADMIN_ONLY_ROUTES = [
  DASHBOARD_ROUTES.attendance,
  DASHBOARD_ROUTES.checkinLegacy,
  DASHBOARD_ROUTES.websiteInformation,
  DASHBOARD_ROUTES.adminExercises,
  "/dashboard/exercise-db",
];

/**
 * Redirect non-admin users away from admin-only dashboard routes.
 * Must run after jwtValidator (ctx.auth is populated).
 */
export function enforceRole(
  ctx: MiddlewareContext
): NextResponse | null {
  if (!isDashboardRoute(ctx.route) || !ctx.auth) {
    return null;
  }

  const { pathname } = ctx.request.nextUrl;

  const isAdminRoute = ADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  if (isAdminRoute && ctx.auth.role !== "admin") {
    const dashboardUrl = new URL(DASHBOARD_ROUTES.overview, ctx.request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return null;
}
