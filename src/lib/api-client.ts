// src/lib/api-client.ts — Shared fetch wrapper for client-side API calls
//
// Transparently unwraps standardized API envelope responses:
// Success: { success: true, data: T } → returns T
// Error:   { success: false, error: { code, message, details? } } → throws ApiRequestError

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  signal?: AbortSignal;
  cache?: RequestCache;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

async function request<T>(
  method: RequestMethod,
  url: string,
  body?: unknown,
  options?: ApiRequestOptions,
): Promise<T> {
  const init: RequestInit = {
    method,
    credentials: "include",
    ...(options?.signal ? { signal: options.signal } : {}),
    ...(options?.cache ? { cache: options.cache } : {}),
  };

  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);

  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    let errorCode: string | undefined;
    let errorDetails: unknown;

    try {
      const json = await res.json();
      // New envelope format: { success: false, error: { code, message, details? } }
      if (json.success === false && json.error) {
        errorMessage = json.error.message || errorMessage;
        errorCode = json.error.code;
        errorDetails = json.error.details;
      } else {
        // Legacy format: { error: string, code?: string }
        errorMessage = json.error || errorMessage;
        errorCode = json.code;
        errorDetails = json.details;
      }
    } catch {
      // Response body not JSON — use default message
    }

    throw new ApiRequestError(res.status, errorMessage, errorCode, errorDetails);
  }

  const json = await res.json();

  // Unwrap standardized envelope: { success: true, data: T } → T
  if (json && json.success === true && "data" in json) {
    return json.data as T;
  }

  // Legacy endpoints that haven't been migrated yet return raw shape
  return json as T;
}

export const api = {
  get: <T>(url: string, options?: ApiRequestOptions) =>
    request<T>("GET", url, undefined, options),

  post: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("POST", url, body, options),

  put: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PUT", url, body, options),

  patch: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("PATCH", url, body, options),

  delete: <T>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    request<T>("DELETE", url, body, options),
};
