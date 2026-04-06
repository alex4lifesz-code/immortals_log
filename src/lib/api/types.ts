// src/lib/api/types.ts — Standardized API response types

/** Enumerated error codes for consistent machine-readable errors */
export const ErrorCode = {
  // Auth
  AUTH_REQUIRED: "AUTH_REQUIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  FORBIDDEN: "FORBIDDEN",

  // Client errors
  BAD_REQUEST: "BAD_REQUEST",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Pagination metadata for list endpoints */
export interface PaginationMeta {
  page?: number;
  limit: number;
  total?: number;
  hasMore?: boolean;
  nextCursor?: string;
}

/** Successful API response envelope */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

/** Error API response envelope */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

/** Union response type for API handlers */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
