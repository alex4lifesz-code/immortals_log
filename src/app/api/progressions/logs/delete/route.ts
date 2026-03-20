import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { logId, userId } = await req.json();

    if (!logId || typeof logId !== "string") {
      return NextResponse.json({ error: "logId is required" }, { status: 400 });
    }

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Find the log and verify ownership
    const log = await prisma.progressionLog.findUnique({
      where: { id: logId },
      include: { userProgression: true },
    });

    if (!log) {
      return NextResponse.json({ error: "Log record not found" }, { status: 404 });
    }

    if (log.userProgression.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.progressionLog.delete({ where: { id: logId } });

    return NextResponse.json({ success: true, message: "Log record deleted successfully" });
  } catch (error) {
    console.error("Progression log delete error:", error);
    return NextResponse.json({ error: "Failed to delete log record" }, { status: 500 });
  }
}
