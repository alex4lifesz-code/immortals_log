import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import {
  isPendingExerciseDescription,
  markExerciseAsDeleted,
  stripExerciseStatusMarkers,
} from "@/lib/pending-exercises";

export const POST = withAuth(async (request, { params }) => {
  try {
    const id = params.id as string;
    const body = await request.json();
    const action = String(body?.action || "").trim().toLowerCase();

    if (action !== "append" && action !== "delete") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const existing = await prisma.progressionExercise.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        story: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    if (!isPendingExerciseDescription(existing.story)) {
      return NextResponse.json({ error: "Exercise is not pending" }, { status: 409 });
    }

    if (action === "append") {
      const updated = await prisma.progressionExercise.update({
        where: { id },
        data: {
          story: stripExerciseStatusMarkers(existing.story),
        },
        select: { id: true, name: true },
      });

      return NextResponse.json({ success: true, exercise: updated });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.progressionTier.updateMany({
        where: { exerciseId: id },
        data: {
          name: "Deleted exercise",
          wuxiaName: "Deleted exercise",
        },
      });

      return tx.progressionExercise.update({
        where: { id },
        data: {
          name: "Deleted exercise",
          wuxiaName: "Deleted exercise",
          story: markExerciseAsDeleted(existing.story),
        },
        select: { id: true, name: true },
      });
    });

    return NextResponse.json({ success: true, exercise: updated });
  } catch (error) {
    console.error("Pending exercise action error:", error);
    return NextResponse.json({ error: "Failed to process pending exercise action" }, { status: 500 });
  }
});
