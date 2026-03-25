import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth/middleware";
import { prisma } from "@/lib/prisma";

export const GET = withAuth(async (_req, { auth }) => {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      unitPreference: true,
      trainingExperience: true,
      fitnessGoals: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
});

export const PATCH = withAuth(async (req, { auth }) => {
  const body = await req.json();
  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 100) : undefined;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : undefined;
  const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl.trim().slice(0, 500) : undefined;
  const unitPreference = typeof body.unitPreference === "string" ? body.unitPreference : undefined;
  const trainingExperience = typeof body.trainingExperience === "string" ? body.trainingExperience : undefined;

  if (email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: auth.userId } }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }
  }

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(displayName !== undefined ? { displayName, name: displayName || "User" } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(avatarUrl !== undefined ? { avatarUrl } : {}),
      ...(unitPreference !== undefined ? { unitPreference } : {}),
      ...(trainingExperience !== undefined ? { trainingExperience } : {}),
    },
    select: {
      id: true,
      username: true,
      email: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      unitPreference: true,
      trainingExperience: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user: updated });
});

export const DELETE = withAuth(async (req, { auth }) => {
  const body = await req.json().catch(() => ({}));
  if (typeof body.password !== "string" || !body.password) {
    return NextResponse.json({ error: "Password confirmation is required" }, { status: 400 });
  }

  const bcrypt = await import("bcryptjs");
  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const matches = await bcrypt.default.compare(body.password, user.password);
  if (!matches) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  await prisma.user.delete({ where: { id: auth.userId } });
  return NextResponse.json({ success: true });
});
