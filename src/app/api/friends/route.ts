import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { FRIEND_STATUS, getAcceptedFriendIds, getFriendRequestBetweenUsers, isMissingFriendSchemaError } from "@/lib/friends";

function sanitizeAction(action: unknown): "accept" | "reject" {
  return action === "accept" ? "accept" : "reject";
}

async function getShareableIdentity(userId: string) {
  try {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, friendCode: true },
    });

    if (!current) {
      return { id: userId, friendCode: userId };
    }

    if (current.friendCode && current.friendCode.trim().length > 0) {
      return { id: current.id, friendCode: current.friendCode };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { friendCode: userId },
      select: { id: true, friendCode: true },
    });

    return { id: updated.id, friendCode: updated.friendCode || updated.id };
  } catch (error) {
    if (isMissingFriendSchemaError(error)) {
      return { id: userId, friendCode: userId };
    }
    throw error;
  }
}

async function findTargetUserId(identifier: string) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { friendCode: identifier },
          { id: identifier },
        ],
      },
      select: { id: true },
    });

    return user?.id || null;
  } catch (error) {
    if (isMissingFriendSchemaError(error)) {
      const user = await prisma.user.findUnique({
        where: { id: identifier },
        select: { id: true },
      });
      return user?.id || null;
    }
    throw error;
  }
}

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const userId = auth.userId;

    const me = await getShareableIdentity(userId);

    let friendIds: string[] = [];
    let incoming: Array<Record<string, unknown>> = [];
    let outgoing: Array<Record<string, unknown>> = [];

    try {
      [friendIds, incoming, outgoing] = await Promise.all([
        getAcceptedFriendIds(userId),
        prisma.friendRequest.findMany({
          where: { receiverId: userId, status: FRIEND_STATUS.PENDING },
          include: {
            requester: { select: { id: true, name: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.friendRequest.findMany({
          where: { requesterId: userId, status: FRIEND_STATUS.PENDING },
          include: {
            receiver: { select: { id: true, name: true, username: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);
    } catch (error) {
      if (!isMissingFriendSchemaError(error)) {
        throw error;
      }
    }

    let friends: Array<{ id: string; name: string; username: string; friendCode?: string | null }> = [];
    if (friendIds.length) {
      try {
        friends = await prisma.user.findMany({
          where: { id: { in: friendIds } },
          select: { id: true, name: true, username: true, friendCode: true },
          orderBy: { name: "asc" },
        });
      } catch (error) {
        if (isMissingFriendSchemaError(error)) {
          friends = await prisma.user.findMany({
            where: { id: { in: friendIds } },
            select: { id: true, name: true, username: true },
            orderBy: { name: "asc" },
          });
        } else {
          throw error;
        }
      }
    }

    return NextResponse.json({
      me,
      friends,
      incomingRequests: incoming,
      outgoingRequests: outgoing,
    });
  } catch (error) {
    console.error("Friends fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch friends" }, { status: 500 });
  }
});

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { toUserId, friendCode } = await request.json();
    const normalizedFriendCode = typeof friendCode === "string" ? friendCode.trim() : "";

    if ((!toUserId || typeof toUserId !== "string") && !normalizedFriendCode) {
      return NextResponse.json({ error: "friendCode is required" }, { status: 400 });
    }

    let targetUserId = typeof toUserId === "string" ? toUserId : "";

    if (!targetUserId && normalizedFriendCode) {
      targetUserId = await findTargetUserId(normalizedFriendCode) || "";
      if (!targetUserId) {
        return NextResponse.json({ error: "No user found for that friend ID" }, { status: 404 });
      }
    }

    if (targetUserId === auth.userId) {
      return NextResponse.json({ error: "You cannot send a request to yourself" }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await getFriendRequestBetweenUsers(auth.userId, targetUserId);
    if (existing) {
      if (existing.status === FRIEND_STATUS.ACCEPTED) {
        return NextResponse.json({ error: "You are already friends" }, { status: 409 });
      }

      if (existing.status === FRIEND_STATUS.PENDING) {
        return NextResponse.json({ error: "A pending request already exists" }, { status: 409 });
      }

      const updated = await prisma.friendRequest.update({
        where: { id: existing.id },
        data: {
          requesterId: auth.userId,
          receiverId: targetUserId,
          status: FRIEND_STATUS.PENDING,
          createdAt: new Date(),
          respondedAt: null,
        },
        include: {
          requester: { select: { id: true, name: true, username: true } },
          receiver: { select: { id: true, name: true, username: true } },
        },
      });

      return NextResponse.json({ request: updated, resent: true });
    }

    const created = await prisma.friendRequest.create({
      data: {
        requesterId: auth.userId,
        receiverId: targetUserId,
        status: FRIEND_STATUS.PENDING,
      },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ request: created, resent: false });
  } catch (error) {
    console.error("Friend request create error:", error);
    return NextResponse.json({ error: "Failed to send request" }, { status: 500 });
  }
});

export const PATCH = withAuth(async (request, { auth }) => {
  try {
    const { requestId, action } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return NextResponse.json({ error: "requestId is required" }, { status: 400 });
    }

    const requestRow = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!requestRow) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    if (requestRow.receiverId !== auth.userId) {
      return NextResponse.json({ error: "Only the receiver can respond" }, { status: 403 });
    }

    if (requestRow.status !== FRIEND_STATUS.PENDING) {
      return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
    }

    const normalizedAction = sanitizeAction(action);
    const nextStatus = normalizedAction === "accept" ? FRIEND_STATUS.ACCEPTED : FRIEND_STATUS.REJECTED;

    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: nextStatus,
        respondedAt: new Date(),
      },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    console.error("Friend request response error:", error);
    return NextResponse.json({ error: "Failed to respond to request" }, { status: 500 });
  }
});

export const DELETE = withAuth(async (request, { auth }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const friendUserId = typeof body.friendUserId === "string" ? body.friendUserId : null;

    if (requestId) {
      const row = await prisma.friendRequest.findUnique({ where: { id: requestId } });
      if (!row) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      const isParticipant = row.requesterId === auth.userId || row.receiverId === auth.userId;
      if (!isParticipant) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }

      if (row.status === FRIEND_STATUS.ACCEPTED) {
        await prisma.friendRequest.delete({ where: { id: requestId } });
      } else {
        await prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: FRIEND_STATUS.CANCELLED, respondedAt: new Date() },
        });
      }

      return NextResponse.json({ success: true });
    }

    if (!friendUserId) {
      return NextResponse.json({ error: "requestId or friendUserId is required" }, { status: 400 });
    }

    const relation = await getFriendRequestBetweenUsers(auth.userId, friendUserId);
    if (!relation) {
      return NextResponse.json({ error: "Friend relationship not found" }, { status: 404 });
    }

    if (relation.status === FRIEND_STATUS.ACCEPTED) {
      await prisma.friendRequest.delete({ where: { id: relation.id } });
    } else {
      await prisma.friendRequest.update({
        where: { id: relation.id },
        data: { status: FRIEND_STATUS.CANCELLED, respondedAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Friend request delete error:", error);
    return NextResponse.json({ error: "Failed to cancel/remove relationship" }, { status: 500 });
  }
});
