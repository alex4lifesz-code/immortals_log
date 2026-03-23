// src/app/api/health/route.ts — Health check endpoint (no auth required)

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Quick DB connectivity check
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json({
      status: "ok",
      timestamp: Date.now(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        timestamp: Date.now(),
        message: "Database unreachable",
      },
      { status: 503 }
    );
  }
}
