// src/middleware/index.ts — Compose middleware steps into a single pipeline

import { NextResponse, type NextRequest } from "next/server";
import type { MiddlewareContext, MiddlewareStep } from "./types";
import { classifyRoute } from "./routeClassifier";
import { handleLegacyRedirects } from "./legacyRedirects";
import { validateJwt } from "./jwtValidator";
import { enforceRole } from "./roleGuard";
import { refreshTokenIfNeeded } from "./tokenRefresher";

/**
 * Build the initial context from the incoming request.
 */
function createContext(request: NextRequest): MiddlewareContext {
  const ctx: MiddlewareContext = {
    request,
    route: "unmatched",
    token: null,
    auth: null,
  };
  classifyRoute(ctx);
  return ctx;
}

/**
 * The ordered middleware pipeline.
 *
 * Execution order:
 * 1. Legacy redirects (before auth — so old bookmarks redirect cleanly)
 * 2. JWT validation (populates ctx.auth or short-circuits with 401/redirect)
 * 3. Role guard (admin-only routes)
 * 4. Token refresh (sliding-window re-sign if nearing expiry)
 *
 * Each step returns NextResponse to short-circuit, or null to continue.
 */
const pipeline: MiddlewareStep[] = [
  handleLegacyRedirects,
  validateJwt,
  enforceRole,
  refreshTokenIfNeeded,
];

/**
 * Run the middleware pipeline for the given request.
 * Returns the first non-null NextResponse from the pipeline,
 * or NextResponse.next() if all steps pass.
 */
export async function runMiddleware(
  request: NextRequest
): Promise<NextResponse> {
  const ctx = createContext(request);

  // Public routes and unmatched paths skip the pipeline entirely
  if (ctx.route === "public-api" || ctx.route === "public-page" || ctx.route === "unmatched") {
    return NextResponse.next();
  }

  for (const step of pipeline) {
    const result = await step(ctx);
    if (result) {
      return result;
    }
  }

  return NextResponse.next();
}
