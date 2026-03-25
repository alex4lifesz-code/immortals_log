import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const PATCH = withAdmin(async (req, { auth, params }) => {
  const targetId = params.id as string;
  const body = await req.json();

  if (auth.userId === targetId && body.isActive === false) {
    return NextResponse.json({ error: "Admin cannot disable own account" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: targetId },
    data: {
      ...(typeof body.isActive === "boolean" ? { isActive: body.isActive } : {}),
      ...(typeof body.role === "string" ? { role: body.role } : {}),
      ...(typeof body.displayName === "string" ? { displayName: body.displayName.trim().slice(0, 100), name: body.displayName.trim().slice(0, 100) || "User" } : {}),
      ...(typeof body.email === "string" ? { email: body.email.trim().toLowerCase() } : {}),
    },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      createdAt: true,
      lastLogin: true,
    },
  });

  return NextResponse.json({ user: updated });
});

export const DELETE = withAdmin(async (_req, { auth, params }) => {
  const targetId = params.id as string;

  if (auth.userId === targetId) {
    return NextResponse.json({ error: "Admin cannot delete own account" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: targetId } });
  return NextResponse.json({ success: true });
});
