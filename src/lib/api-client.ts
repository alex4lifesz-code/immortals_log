// src/lib/api-client.ts — Shared fetch wrapper for client-side API calls

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface ApiRequestOptions {
  signal?: AbortSignal;
  cache?: RequestCache;
}

interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, unknown>,
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
    let errorData: ApiErrorResponse = { error: `Request failed (${res.status})` };
    try {
      errorData = await res.json();
    } catch {
      // Response body not JSON — use default message
    }
    throw new ApiRequestError(
      res.status,
      errorData.error || `Request failed (${res.status})`,
      errorData.code,
      errorData.details,
    );
  }

  return res.json() as Promise<T>;
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
