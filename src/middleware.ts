// src/middleware.ts — Next.js edge middleware entry point
//
// All logic is decomposed into composable functions under src/middleware/.
// This file simply delegates to the pipeline composer.

import type { NextRequest } from "next/server";
import { runMiddleware } from "./middleware/pipeline";

export async function middleware(request: NextRequest) {
  return runMiddleware(request);
}

export const config = {
  matcher: [
    // Match all API routes except static files and _next
    "/api/:path*",
    // Match all dashboard routes
    "/dashboard/:path*",
    // Match onboarding routes (auth-protected)
    "/onboarding/:path*",
    "/onboarding",
  ],
};
