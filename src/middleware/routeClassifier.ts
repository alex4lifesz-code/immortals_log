// src/middleware/routeClassifier.ts — Classify incoming request route type

import type { MiddlewareContext, RouteType } from "./types";
import { COOKIE_NAME } from "./cookieUtils";

/** API routes that do NOT require authentication */
const PUBLIC_API_ROUTES = new Set([
  "/api/auth/login",
  "/api/health",
]);

const API_PREFIX = "/api/";
const DASHBOARD_PREFIX = "/dashboard";
const ONBOARDING_PREFIX = "/onboarding";

/**
 * Determine the route type and extract the auth token from cookies.
 * Populates `ctx.route` and `ctx.token`.
 */
export function classifyRoute(ctx: MiddlewareContext): void {
  const { pathname } = ctx.request.nextUrl;

  if (PUBLIC_API_ROUTES.has(pathname)) {
    ctx.route = "public-api";
  } else if (pathname.startsWith(API_PREFIX)) {
    ctx.route = "protected-api";
  } else if (
    pathname === DASHBOARD_PREFIX ||
    pathname.startsWith(`${DASHBOARD_PREFIX}/`)
  ) {
    ctx.route = "protected-dashboard";
  } else if (
    pathname === ONBOARDING_PREFIX ||
    pathname.startsWith(`${ONBOARDING_PREFIX}/`)
  ) {
    ctx.route = "protected-dashboard";
  } else {
    ctx.route = "unmatched";
  }

  // Extract token regardless of route type (needed for refresh on dashboard)
  ctx.token = ctx.request.cookies.get(COOKIE_NAME)?.value ?? null;
}

/** Check helpers — useful in other middleware steps */
export function isPublicRoute(route: RouteType): boolean {
  return route === "public-page" || route === "public-api" || route === "unmatched";
}

export function isProtectedRoute(route: RouteType): boolean {
  return route === "protected-api" || route === "protected-dashboard";
}

export function isApiRoute(route: RouteType): boolean {
  return route === "public-api" || route === "protected-api";
}

export function isDashboardRoute(route: RouteType): boolean {
  return route === "protected-dashboard";
}
