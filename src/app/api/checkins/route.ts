import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const checkins = await prisma.checkIn.findMany({
      include: { user: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
    });
    return NextResponse.json({ checkins });
  } catch (error) {
    console.error("CheckIn fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch check-ins" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { date, entries, requestingUserId } = await req.json();

    if (!date || !entries || typeof entries !== "object" || Array.isArray(entries)) {
      return NextResponse.json(
        { error: "Date and entries object are required" },
        { status: 400 }
      );
    }

    // Validate date format
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json(
        { error: "Invalid date" },
        { status: 400 }
      );
    }

    // Validate that the requesting user is only modifying their own entries
    if (requestingUserId) {
      if (typeof requestingUserId !== "string") {
        return NextResponse.json(
          { error: "Invalid requestingUserId" },
          { status: 400 }
        );
      }
      const entryUserIds = Object.keys(entries);
      const unauthorisedIds = entryUserIds.filter(id => id !== requestingUserId);
      if (unauthorisedIds.length > 0) {
        return NextResponse.json(
          { error: "You can only modify your own check-in entries" },
          { status: 403 }
        );
      }
    }

    // Upsert each entry with validation
    const operations = Object.entries(entries as Record<string, { present?: boolean; weight?: number; comment?: string }>).map(
      ([userId, data]) => {
        const weight = data.weight ? parseFloat(String(data.weight)) : null;
        const comment = data.comment ? String(data.comment).slice(0, 500) : null;
        return prisma.checkIn.upsert({
          where: {
            date_userId: { date: dateObj, userId },
          },
          create: {
            date: dateObj,
            userId,
            present: data.present || false,
            weight: weight !== null && !isNaN(weight) && weight >= 0 && weight <= 1000 ? weight : null,
            comment,
          },
          update: {
            present: data.present || false,
            weight: weight !== null && !isNaN(weight) && weight >= 0 && weight <= 1000 ? weight : null,
            comment,
          },
        });
      }
    );

    await Promise.all(operations);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("CheckIn save error:", error);
    return NextResponse.json(
      { error: "Failed to save check-ins" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const result = await prisma.checkIn.deleteMany({});
    return NextResponse.json({
      success: true,
      message: `Removed ${result.count} check-in record(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("CheckIn delete error:", error);
    return NextResponse.json(
      { error: "Failed to remove check-in records" },
      { status: 500 }
    );
  }
}
