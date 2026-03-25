import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  const email = request.nextUrl.searchParams.get("email")?.trim().toLowerCase();

  if (!username && !email) {
    return NextResponse.json({ error: "username or email query is required" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(username ? [{ username }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    select: { id: true, username: true, email: true },
  });

  return NextResponse.json({
    usernameAvailable: username ? !(existing && existing.username === username) : true,
    emailAvailable: email ? !(existing && existing.email === email) : true,
  });
}
