// src/app/api/health/route.ts — Health check endpoint (no auth required)

import { apiSuccess, ApiErrors } from "@/lib/api";
import { checkDatabaseReachable } from "@/lib/repositories/system.repository";

export async function GET() {
  try {
    // Quick DB connectivity check
    await checkDatabaseReachable();

    return apiSuccess({
      status: "ok",
      timestamp: Date.now(),
    });
  } catch {
    return ApiErrors.unavailable("Database unreachable");
  }
}
