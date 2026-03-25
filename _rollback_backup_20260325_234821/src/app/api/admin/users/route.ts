import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAdmin(async (req) => {
  const search = new URL(req.url).searchParams.get("search")?.trim().toLowerCase();

  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
            { displayName: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : undefined,
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      name: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLogin: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ users });
});
