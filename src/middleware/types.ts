// src/middleware/types.ts — Type definitions for composable middleware

import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";

/** JWT payload extracted from auth-token cookie */
export interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  role: string;
  iat: number;
  exp: number;
}

/** Classification of the incoming request route */
export type RouteType =
  | "public-page"
  | "public-api"
  | "protected-api"
  | "protected-dashboard"
  | "unmatched";

/** Context threaded through the middleware pipeline */
export interface MiddlewareContext {
  request: NextRequest;
  route: RouteType;
  /** Raw JWT string from cookie, if present */
  token: string | null;
  /** Decoded JWT payload, populated by jwtValidator */
  auth: JwtPayload | null;
}

/**
 * A middleware step returns either:
 * - A NextResponse (short-circuits the pipeline), or
 * - null (continue to next step)
 */
export type MiddlewareStep = (
  ctx: MiddlewareContext
) => Promise<NextResponse | null> | NextResponse | null;
