import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth/middleware";
import { FRIEND_STATUS } from "@/lib/friends";

export const GET = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status = typeof statusParam === "string" && statusParam.trim() ? statusParam.trim() : FRIEND_STATUS.PENDING;

    const requests = await prisma.friendRequest.findMany({
      where: { status },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Admin friend requests fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch friend requests" }, { status: 500 });
  }
});

export const PATCH = withAdmin(async (request) => {
  try {
    const { requestId, status } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    if (status !== FRIEND_STATUS.ACCEPTED && status !== FRIEND_STATUS.REJECTED && status !== FRIEND_STATUS.CANCELLED) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status,
        respondedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("Admin friend request update error:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
});
