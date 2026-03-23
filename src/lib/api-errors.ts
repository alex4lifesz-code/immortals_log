// src/lib/api-errors.ts — Standardized API error responses

import { NextResponse } from "next/server";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function createErrorResponse(error: ApiError | Error): Response {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  console.error("Unexpected error:", error);
  return NextResponse.json(
    { error: "Internal server error", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

/** Pre-defined error factories */
export const Errors = {
  unauthorized: (message = "Authentication required") =>
    new ApiError(401, message, "UNAUTHORIZED"),

  forbidden: (message = "Access denied") =>
    new ApiError(403, message, "FORBIDDEN"),

  notFound: (resource: string) =>
    new ApiError(404, `${resource} not found`, "NOT_FOUND"),

  badRequest: (message: string, details?: Record<string, unknown>) =>
    new ApiError(400, message, "BAD_REQUEST", details),

  conflict: (message: string) => new ApiError(409, message, "CONFLICT"),

  rateLimited: () => new ApiError(429, "Too many requests", "RATE_LIMITED"),

  validationFailed: (errors: string[]) =>
    new ApiError(400, "Validation failed", "VALIDATION_FAILED", { errors }),

  internal: (message = "Internal server error") =>
    new ApiError(500, message, "INTERNAL_ERROR"),
};
