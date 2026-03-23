import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId || typeof userId !== "string" || userId.length > 200) {
    return NextResponse.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  try {
    const latest = await prisma.checkIn.findFirst({
      where: {
        userId,
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
}
