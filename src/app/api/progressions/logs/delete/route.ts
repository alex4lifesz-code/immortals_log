import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { logId } = await request.json();

    if (!logId || typeof logId !== "string") {
      return NextResponse.json({ error: "logId is required" }, { status: 400 });
    }

    // Find the log and verify ownership
    const log = await prisma.progressionLog.findUnique({
      where: { id: logId },
      include: { userProgression: true },
    });

    if (!log) {
      return NextResponse.json({ error: "Log record not found" }, { status: 404 });
    }

    if (log.userProgression.userId !== auth.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.progressionLog.delete({ where: { id: logId } });

    return NextResponse.json({ success: true, message: "Log record deleted successfully" });
  } catch (error) {
    console.error("Progression log delete error:", error);
    return NextResponse.json({ error: "Failed to delete log record" }, { status: 500 });
  }
});
