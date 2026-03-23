import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

const ARCHIVED_TARGET_GROUP = "__archived__";

export const GET = withAuth(async () => {
  try {
    const exercises = await prisma.exercise.findMany({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Exercises fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch exercises" },
      { status: 500 }
    );
  }
});

export const POST = withAuth(async (req, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const name = String(body.name || body.originalName || "")
      .trim()
      .slice(0, 200);
    const wuxiaName = String(body.wuxiaName || body.name || "")
      .trim()
      .slice(0, 200);
    const difficulty = String(body.difficulty || "").trim();
    const type = String(body.type || "").trim();
    const story = body.story
      ? String(body.story).trim().slice(0, 2000)
      : undefined;
    const targetGroup = body.targetGroup
      ? String(body.targetGroup).trim().slice(0, 100)
      : undefined;

    if (!name || !difficulty || !type) {
      return NextResponse.json(
        { error: "Name, difficulty, and type are required" },
        { status: 400 }
      );
    }

    const validDifficulties = [
      "mortal",
      "foundation establishment",
      "core formation",
      "nascent soul",
      "soul splitting",
      "tribulation transcendence",
      "immortal",
      "heavenly dao",
    ];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Difficulty must be one of: ${validDifficulties.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // SQLite doesn't support mode:"insensitive", so fetch candidates and filter in JS
    const archivedCandidates = await prisma.exercise.findMany({
      where: { targetGroup: ARCHIVED_TARGET_GROUP },
    });
    const archivedMatch =
      archivedCandidates.find(
        (ex) => ex.name.toLowerCase() === name.toLowerCase()
      ) ?? null;

    const exercise = archivedMatch
      ? await prisma.exercise.update({
          where: { id: archivedMatch.id },
          data: {
            wuxiaName: wuxiaName || null,
            difficulty,
            type,
            story,
            targetGroup: targetGroup || null,
          },
        })
      : await prisma.exercise.create({
          data: {
            name,
            wuxiaName: wuxiaName || null,
            difficulty,
            type,
            story,
            targetGroup,
          },
        });

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Exercise create error:", error);
    return NextResponse.json(
      { error: "Failed to create exercise" },
      { status: 500 }
    );
  }
});

export const DELETE = withAuth(async (_req, { auth }) => {
  try {
    if (auth.role !== "admin") {
      return NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 }
      );
    }

    const deleteResult = await prisma.exercise.deleteMany({
      where: {
        NOT: {
          targetGroup: ARCHIVED_TARGET_GROUP,
        },
      },
    });

    return NextResponse.json({
      message: `Library purged. ${deleteResult.count} technique(s) deleted.`,
      deleted: deleteResult.count,
      archived: 0,
    });
  } catch (error) {
    console.error("Exercise bulk delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove techniques" },
      { status: 500 }
    );
  }
});
