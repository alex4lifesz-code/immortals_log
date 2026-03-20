import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeDayAssignments } from "@/lib/constants";

// GET /api/progressions/[id]?userId=X — get a single progression exercise with full details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const exercise = await prisma.progressionExercise.findFirst({
      where: { id, userId },
      include: {
        tiers: { orderBy: { level: "asc" } },
        variations: true,
        modifiers: true,
        userProgress: {
          where: { userId },
          include: {
            logs: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Progression fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch progression" }, { status: 500 });
  }
}

// DELETE /api/progressions/[id]?userId=X — delete a single progression exercise
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const exercise = await prisma.progressionExercise.findFirst({
      where: { id, userId },
    });

    if (!exercise) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    await prisma.userProgressionLevel.deleteMany({ where: { userId, exerciseId: id } });
    await prisma.progressionExercise.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Progression delete error:", error);
    return NextResponse.json({ error: "Failed to delete progression" }, { status: 500 });
  }
}

// PATCH /api/progressions/[id] — update assignedDays for a progression exercise
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { assignedDays, userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!Array.isArray(assignedDays)) {
      return NextResponse.json(
        { error: "assignedDays must be an array of day indices (0-6)" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.progressionExercise.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    const validDays = assignedDays.filter(
      (day: unknown) => typeof day === "number" && day >= 0 && day <= 6
    );

    const serializedDays = serializeDayAssignments(validDays);

    const exercise = await prisma.progressionExercise.update({
      where: { id },
      data: { assignedDays: serializedDays },
    });

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Progression update error:", error);
    return NextResponse.json(
      { error: "Failed to update progression day assignments" },
      { status: 500 }
    );
  }
}
