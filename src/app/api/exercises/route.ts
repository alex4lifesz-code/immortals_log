import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const exercises = await prisma.exercise.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ exercises });
  } catch (error) {
    console.error("Exercises fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch exercises" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name || body.originalName || "").trim().slice(0, 200);
    const wuxiaName = String(body.wuxiaName || body.name || "").trim().slice(0, 200);
    const difficulty = String(body.difficulty || "").trim();
    const type = String(body.type || "").trim();
    const story = body.story ? String(body.story).trim().slice(0, 2000) : undefined;
    const targetGroup = body.targetGroup ? String(body.targetGroup).trim().slice(0, 100) : undefined;

    if (!name || !difficulty || !type) {
      return NextResponse.json(
        { error: "Name, difficulty, and type are required" },
        { status: 400 }
      );
    }

    const validDifficulties = ["mortal", "foundation establishment", "core formation", "nascent soul", "soul splitting", "tribulation transcendence", "immortal"];
    if (!validDifficulties.includes(difficulty.toLowerCase())) {
      return NextResponse.json(
        { error: `Difficulty must be one of: ${validDifficulties.join(", ")}` },
        { status: 400 }
      );
    }

    const validTypes = ["upper heaven", "lower realms", "heart meridian", "unified realm"];
    if (!validTypes.includes(type.toLowerCase())) {
      return NextResponse.json(
        { error: `Type must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    const exercise = await prisma.exercise.create({
      data: { name, wuxiaName: wuxiaName || null, difficulty, type, story, targetGroup },
    });

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Exercise create error:", error);
    return NextResponse.json({ error: "Failed to create exercise" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    // Delete all simplified workout exercises first (foreign key constraint)
    await prisma.simplifiedWorkoutExercise.deleteMany({});
    // Then delete all exercises
    const result = await prisma.exercise.deleteMany({});
    return NextResponse.json({
      message: `All ${result.count} technique(s) removed`,
      deleted: result.count,
    });
  } catch (error) {
    console.error("Exercise bulk delete error:", error);
    return NextResponse.json({ error: "Failed to remove techniques" }, { status: 500 });
  }
}
