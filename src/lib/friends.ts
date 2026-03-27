import { prisma } from "@/lib/prisma";

function isMissingFriendRequestTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (maybeCode === "P2021") return true;

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /friendrequest|friend_request|no such table/i.test(maybeMessage);
}

export function isMissingFriendSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (maybeCode === "P2021" || maybeCode === "P2022") return true;

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /friendrequest|friend_request|friendcode|friend_code|no such table|no such column/i.test(maybeMessage);
}

export const FRIEND_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export type FriendStatus = (typeof FRIEND_STATUS)[keyof typeof FRIEND_STATUS];

export function normalizeScope(
  scope: string | null | undefined,
  defaultScope: "friends" | "community" = "friends"
): "friends" | "community" {
  if (scope === "community") return "community";
  if (scope === "friends") return "friends";
  return defaultScope;
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  let rows: Array<{ requesterId: string; receiverId: string }> = [];
  try {
    rows = await prisma.friendRequest.findMany({
      where: {
        status: FRIEND_STATUS.ACCEPTED,
        OR: [{ requesterId: userId }, { receiverId: userId }],
      },
      select: {
        requesterId: true,
        receiverId: true,
      },
    });
  } catch (error) {
    if (isMissingFriendRequestTableError(error)) {
      return [];
    }
    throw error;
  }

  const ids = new Set<string>();
  for (const row of rows) {
    if (row.requesterId !== userId) ids.add(row.requesterId);
    if (row.receiverId !== userId) ids.add(row.receiverId);
  }
  return [...ids];
}

export async function areUsersFriends(userId: string, otherUserId: string): Promise<boolean> {
  if (userId === otherUserId) return true;
  let relation: { id: string } | null = null;
  try {
    relation = await prisma.friendRequest.findFirst({
      where: {
        status: FRIEND_STATUS.ACCEPTED,
        OR: [
          { requesterId: userId, receiverId: otherUserId },
          { requesterId: otherUserId, receiverId: userId },
        ],
      },
      select: { id: true },
    });
  } catch (error) {
    if (isMissingFriendRequestTableError(error)) {
      return false;
    }
    throw error;
  }
  return Boolean(relation);
}

export async function canViewUserData(params: {
  viewerId: string;
  viewerRole: string;
  targetUserId: string;
}): Promise<boolean> {
  const { viewerId, viewerRole, targetUserId } = params;
  if (viewerRole === "admin") return true;
  if (viewerId === targetUserId) return true;
  return areUsersFriends(viewerId, targetUserId);
}

export async function getVisibleSocialUserIds(params: {
  viewerId: string;
  viewerRole: string;
  scope: "friends" | "community";
}): Promise<string[]> {
  const { viewerId, viewerRole, scope } = params;

  if (viewerRole === "admin") {
    if (scope === "community") {
      const users = await prisma.user.findMany({ select: { id: true } });
      return users.map((user) => user.id);
    }
    return [viewerId, ...(await getAcceptedFriendIds(viewerId))];
  }

  if (scope === "community") {
    const users = await prisma.user.findMany({ select: { id: true } });
    return users.map((user) => user.id);
  }

  return [viewerId, ...(await getAcceptedFriendIds(viewerId))];
}

export async function getFriendRequestBetweenUsers(userA: string, userB: string) {
  try {
    return await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { requesterId: userA, receiverId: userB },
          { requesterId: userB, receiverId: userA },
        ],
      },
      include: {
        requester: { select: { id: true, name: true, username: true } },
        receiver: { select: { id: true, name: true, username: true } },
      },
    });
  } catch (error) {
    if (isMissingFriendRequestTableError(error)) {
      return null;
    }
    throw error;
  }
}
