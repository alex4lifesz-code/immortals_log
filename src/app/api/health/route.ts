// src/app/api/health/route.ts — Health check endpoint (no auth required)

import { prisma } from "@/lib/prisma";
import { apiSuccess, ApiErrors } from "@/lib/api";

export async function GET() {
  try {
    // Quick DB connectivity check
    await prisma.$queryRawUnsafe("SELECT 1");

    return apiSuccess({
      status: "ok",
      timestamp: Date.now(),
    });
  } catch {
    return ApiErrors.unavailable("Database unreachable");
  }
}
