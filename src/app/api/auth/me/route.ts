// src/app/api/auth/me/route.ts — Get current authenticated user info

import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request);
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication required", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  // Fetch fresh user data from DB to ensure it's up to date
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, username: true, name: true, role: true },
  });

  if (!user) {
    return NextResponse.json(
      { error: "User not found", code: "NOT_FOUND" },
      { status: 404 }
    );
  }

  return NextResponse.json({ user });
}
