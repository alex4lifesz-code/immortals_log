import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const PATCH = withAuth(async (req, { auth, params }) => {
  try {
    const id = params.id as string;

    // Users can only update their own profile, unless admin
    if (auth.userId !== id && auth.role !== "admin") {
      return NextResponse.json(
        { error: "You can only update your own profile" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "A valid display name is required" },
        { status: 400 }
      );
    }

    const trimmedName = name.trim().slice(0, 100);

    const user = await prisma.user.update({
      where: { id },
      data: { name: trimmedName },
      select: { id: true, username: true, name: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (_req, { auth, params }) => {
  try {
    const id = params.id as string;

    // Only admin can delete users
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Admin cannot delete themselves
    if (auth.userId === id) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 403 }
      );
    }

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Remove directly-related rows that may not be configured with cascade.
      await tx.userProgressionLevel.deleteMany({ where: { userId: id } });
      await tx.progressionExercise.deleteMany({ where: { userId: id } });
      await tx.checkInNote.deleteMany({ where: { userId: id } });
      await tx.checkIn.deleteMany({ where: { userId: id } });
      await tx.userSettings.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("User delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
});
