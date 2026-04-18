// src/middleware/legacyRedirects.ts — Handle legacy route redirects that need runtime context
//
// NOTE: Simple path-to-path redirects should live in next.config.ts instead.
// This file handles redirects that depend on dynamic path segments or need
// to preserve complex query strings alongside path rewriting.

import { NextResponse } from "next/server";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import type { MiddlewareContext } from "./types";
import { isDashboardRoute } from "./routeClassifier";

interface RedirectRule {
  /** Exact path match or prefix match (ending with /) */
  match: string;
  /** If true, match is a prefix; otherwise exact match */
  prefix: boolean;
  /** Build the target pathname from the original pathname */
  target: (pathname: string) => string;
}

const LEGACY_RULES: RedirectRule[] = [
  {
    match: "/dashboard/workout-history",
    prefix: false,
    target: () => DASHBOARD_ROUTES.workoutHistory,
  },
];

/**
 * Redirect legacy dashboard routes to their canonical paths.
 * Runs early in the pipeline (before auth) so unauthenticated users
 * hitting legacy URLs still get redirected to the correct path
 * (auth middleware will handle the login redirect at the new URL).
 *
 * Simple redirects (overview→check-in, main→check-in) are handled
 * in next.config.ts via the redirects() config.
 */
export function handleLegacyRedirects(
  ctx: MiddlewareContext
): NextResponse | null {
  if (!isDashboardRoute(ctx.route)) {
    return null;
  }

  const { pathname } = ctx.request.nextUrl;

  for (const rule of LEGACY_RULES) {
    const matches = rule.prefix
      ? pathname.startsWith(rule.match)
      : pathname === rule.match;

    if (matches) {
      const targetPath = rule.target(pathname);
      if (targetPath !== pathname) {
        const url = ctx.request.nextUrl.clone();
        url.pathname = targetPath;
        return NextResponse.redirect(url);
      }
    }
  }

  return null;
}
