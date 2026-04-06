// src/lib/api/response.ts — Standardized API response helpers

import { NextResponse } from "next/server";
import { ErrorCode, type PaginationMeta } from "./types";

/**
 * Return a standardized success response.
 *
 * @example
 *   return apiSuccess({ checkins }, { limit: 20, total: 100 });
 *   // → { success: true, data: { checkins: [...] }, meta: { limit: 20, total: 100 } }
 */
export function apiSuccess<T>(data: T, meta?: PaginationMeta, init?: { status?: number }): NextResponse {
  const body: Record<string, unknown> = { success: true, data };
  if (meta) body.meta = meta;
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

/**
 * Return a standardized error response.
 *
 * @example
 *   return apiError(ErrorCode.NOT_FOUND, "User not found", 404);
 *   // → { success: false, error: { code: "NOT_FOUND", message: "User not found" } }
 */
export function apiError(
  code: ErrorCode,
  message: string,
  status: number,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details !== undefined ? { details } : {}) },
    },
    { status },
  );
}

/** Shorthand helpers for common error responses */
export const ApiErrors = {
  unauthorized: (message = "Authentication required") =>
    apiError(ErrorCode.AUTH_REQUIRED, message, 401),

  invalidToken: (message = "Invalid or expired token") =>
    apiError(ErrorCode.INVALID_TOKEN, message, 401),

  forbidden: (message = "Access denied") =>
    apiError(ErrorCode.FORBIDDEN, message, 403),

  badRequest: (message: string, details?: unknown) =>
    apiError(ErrorCode.BAD_REQUEST, message, 400, details),

  validationError: (message: string, details?: unknown) =>
    apiError(ErrorCode.VALIDATION_ERROR, message, 422, details),

  notFound: (message = "Resource not found") =>
    apiError(ErrorCode.NOT_FOUND, message, 404),

  conflict: (message: string, details?: unknown) =>
    apiError(ErrorCode.CONFLICT, message, 409, details),

  rateLimited: (message = "Too many requests", retryAfter?: string) =>
    apiError(ErrorCode.RATE_LIMITED, message, 429, retryAfter ? { retryAfter } : undefined),

  internal: (message = "Internal server error") =>
    apiError(ErrorCode.INTERNAL_ERROR, message, 500),

  unavailable: (message = "Service temporarily unavailable") =>
    apiError(ErrorCode.SERVICE_UNAVAILABLE, message, 503),
} as const;
