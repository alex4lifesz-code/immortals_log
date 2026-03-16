import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/checkins/notes?date=YYYY-MM-DD  — fetch all community notes for a date (or all if no date)
// GET /api/checkins/notes?future=true — fetch notes for dates beyond today
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");
    const future = searchParams.get("future");
    const clientToday = searchParams.get("today");

    let where: Record<string, unknown> = {};
    if (future === "true") {
      const todayStr = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
        ? clientToday
        : (() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; })();
      where = { date: { gt: todayStr } };
    } else if (date) {
      where = { date };
    }

    const notes = await prisma.checkInNote.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("CheckInNote fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notes" },
      { status: 500 }
    );
  }
}

// POST /api/checkins/notes — create a new note
export async function POST(req: NextRequest) {
  try {
    const { date, userId, content } = await req.json();

    if (!date || !userId || !content?.trim()) {
      return NextResponse.json(
        { error: "Date, userId, and content are required" },
        { status: 400 }
      );
    }

    // Validate date format
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format (expected YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Validate userId type
    if (typeof userId !== "string") {
      return NextResponse.json(
        { error: "Invalid userId" },
        { status: 400 }
      );
    }

    const trimmedContent = String(content).trim().slice(0, 2000);

    const existing = await prisma.checkInNote.findFirst({
      where: { date, userId },
    });

    const note = existing
      ? await prisma.checkInNote.update({
          where: { id: existing.id },
          data: { content: trimmedContent },
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        })
      : await prisma.checkInNote.create({
          data: {
            date,
            userId,
            content: trimmedContent,
          },
          include: {
            user: { select: { id: true, name: true, username: true } },
          },
        });

    return NextResponse.json({ note, updated: Boolean(existing) });
  } catch (error) {
    console.error("CheckInNote create error:", error);
    return NextResponse.json(
      { error: "Failed to create note" },
      { status: 500 }
    );
  }
}

// PATCH /api/checkins/notes — toggle pin on a note
export async function PATCH(req: NextRequest) {
  try {
    const { noteId, userId, pinned } = await req.json();

    if (!noteId || !userId) {
      return NextResponse.json(
        { error: "noteId and userId are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.checkInNote.findUnique({
      where: { id: noteId },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "Note not found or not owned by user" },
        { status: 403 }
      );
    }

    const note = await prisma.checkInNote.update({
      where: { id: noteId },
      data: { pinned: typeof pinned === "boolean" ? pinned : !existing.pinned },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error("CheckInNote pin error:", error);
    return NextResponse.json(
      { error: "Failed to update note" },
      { status: 500 }
    );
  }
}

// DELETE /api/checkins/notes — delete a note (owner only)
export async function DELETE(req: NextRequest) {
  try {
    const { noteId, userId } = await req.json();

    if (!noteId || !userId) {
      return NextResponse.json(
        { error: "noteId and userId are required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const existing = await prisma.checkInNote.findUnique({
      where: { id: noteId },
    });

    if (!existing || existing.userId !== userId) {
      return NextResponse.json(
        { error: "Note not found or not owned by user" },
        { status: 403 }
      );
    }

    await prisma.checkInNote.delete({ where: { id: noteId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CheckInNote delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete note" },
      { status: 500 }
    );
  }
}
