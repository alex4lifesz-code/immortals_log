import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const latest = await prisma.checkIn.findFirst({
      where: {
        userId: auth.userId,
        weight: { not: null },
      },
      orderBy: { date: "desc" },
      select: { weight: true, date: true },
    });

    if (!latest || latest.weight == null) {
      return NextResponse.json({ weight: null, date: null });
    }

    return NextResponse.json({ weight: latest.weight, date: latest.date });
  } catch (error) {
    console.error("Latest weight fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch latest weight" }, { status: 500 });
  }
});
