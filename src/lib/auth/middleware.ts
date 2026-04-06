// src/lib/auth/middleware.ts — API route handler wrappers for authentication

import { NextResponse } from "next/server";
import { getAuthFromRequest } from "./index";
import type { AuthContext } from "./types";
import { AuthError } from "./types";
import { ApiErrors } from "@/lib/api";

type RouteParams = Record<string, string | string[]>;

/**
 * Context passed to authenticated API route handlers.
 */
interface HandlerContext {
  auth: AuthContext;
  params: RouteParams;
}

/**
 * Context passed to optionally-authenticated API route handlers.
 */
interface OptionalAuthHandlerContext {
  auth: AuthContext | null;
  params: RouteParams;
}

type AuthenticatedHandler = (
  request: Request,
  context: HandlerContext
) => Promise<Response>;

type OptionalAuthHandler = (
  request: Request,
  context: OptionalAuthHandlerContext
) => Promise<Response>;

/**
 * Wraps an API route handler to require authentication.
 * Parses the auth cookie, verifies the JWT, and passes the authenticated
 * user to the handler. Returns 401 if not authenticated.
 *
 * @example
 * ```ts
 * export const GET = withAuth(async (request, { auth, params }) => {
 *   // auth.userId, auth.role are guaranteed to be present
 *   return NextResponse.json({ userId: auth.userId });
 * });
 * ```
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: Request,
    routeContext?: { params?: Promise<RouteParams> | RouteParams }
  ): Promise<Response> => {
    try {
      const auth = await getAuthFromRequest(request);
      if (!auth) {
        return ApiErrors.unauthorized();
      }

      const params = routeContext?.params
        ? routeContext.params instanceof Promise
          ? await routeContext.params
          : routeContext.params
        : {};

      return await handler(request, { auth, params });
    } catch (error) {
      if (error instanceof AuthError) {
        return ApiErrors.unauthorized(error.message);
      }
      console.error("Unhandled error in authenticated route:", error);
      return ApiErrors.internal();
    }
  };
}

/**
 * Wraps an API route handler to require admin role.
 * Returns 401 if not authenticated, 403 if not admin.
 *
 * @example
 * ```ts
 * export const POST = withAdmin(async (request, { auth }) => {
 *   // auth.role is guaranteed to be "admin"
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withAdmin(handler: AuthenticatedHandler) {
  return withAuth(async (request, context) => {
    if (context.auth.role !== "admin") {
      return ApiErrors.forbidden("Admin access required");
    }
    return handler(request, context);
  });
}

/**
 * Wraps an API route handler to optionally provide authentication.
 * The handler always runs, but auth may be null if no valid token is present.
 *
 * @example
 * ```ts
 * export const GET = withOptionalAuth(async (request, { auth }) => {
 *   if (auth) {
 *     // User is authenticated
 *   } else {
 *     // Anonymous access
 *   }
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withOptionalAuth(handler: OptionalAuthHandler) {
  return async (
    request: Request,
    routeContext?: { params?: Promise<RouteParams> | RouteParams }
  ): Promise<Response> => {
    try {
      const auth = await getAuthFromRequest(request);

      const params = routeContext?.params
        ? routeContext.params instanceof Promise
          ? await routeContext.params
          : routeContext.params
        : {};

      return await handler(request, { auth, params });
    } catch (error) {
      if (error instanceof AuthError) {
        return ApiErrors.unauthorized(error.message);
      }
      console.error("Unhandled error in route:", error);
      return ApiErrors.internal();
    }
  };
}
