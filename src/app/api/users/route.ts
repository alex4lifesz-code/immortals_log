import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        createdAt: true,
        experience: true,
        _count: {
          select: {
            workouts: true,
            checkIns: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Users fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
