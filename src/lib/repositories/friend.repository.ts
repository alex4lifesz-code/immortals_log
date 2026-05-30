import { prisma } from "@/lib/prisma";

function isMissingFriendSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeCode = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  if (maybeCode === "P2021" || maybeCode === "P2022") return true;

  const maybeMessage = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return /friendrequest|friend_request|friendcode|friend_code|no such table|no such column/i.test(maybeMessage);
}

const FRIEND_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  CANCELLED: "cancelled",
} as const;

export function isUniqueConstraintError(error: unknown): boolean {
  const maybeCode = typeof error === "object" && error !== null && "code" in error
    ? (error as { code?: unknown }).code
    : undefined;

  return maybeCode === "P2002";
}

export async function getUserIdentityById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, friendCode: true },
  });
}

export async function updateUserFriendCode(userId: string, friendCode: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { friendCode },
    select: { id: true, friendCode: true },
  });
}

export async function findFriendUserIdByFriendCode(friendCode: string) {
  const user = await prisma.user.findFirst({
    where: {
      friendCode,
    },
    select: { id: true },
  });

  return user?.id || null;
}

export async function findFriendUserById(userId: string) {
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
}

export async function getPendingIncomingRequests(userId: string) {
  return prisma.friendRequest.findMany({
    where: { receiverId: userId, status: FRIEND_STATUS.PENDING },
    include: {
      requester: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAcceptedFriendRows(userId: string) {
  return prisma.friendRequest.findMany({
    where: {
      status: FRIEND_STATUS.ACCEPTED,
      OR: [{ requesterId: userId }, { receiverId: userId }],
    },
    select: {
      requesterId: true,
      receiverId: true,
    },
  });
}

export async function findAcceptedFriendRelation(userId: string, otherUserId: string) {
  return prisma.friendRequest.findFirst({
    where: {
      status: FRIEND_STATUS.ACCEPTED,
      OR: [
        { requesterId: userId, receiverId: otherUserId },
        { requesterId: otherUserId, receiverId: userId },
      ],
    },
    select: { id: true },
  });
}

export async function getAllUserIds() {
  const users = await prisma.user.findMany({ select: { id: true } });
  return users.map((user) => user.id);
}

export async function findFriendRequestRelationBetweenUsers(userA: string, userB: string) {
  return prisma.friendRequest.findFirst({
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
}

export async function getPendingOutgoingRequests(userId: string) {
  return prisma.friendRequest.findMany({
    where: { requesterId: userId, status: FRIEND_STATUS.PENDING },
    include: {
      receiver: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFriendsWithStats(friendIds: string[]) {
  const [friendUsers, progressionLevels] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: {
        id: true,
        name: true,
        username: true,
        friendCode: true,
        createdAt: true,
        updatedAt: true,
        settings: {
          select: {
            pinnedNavItems: true,
          },
        },
        checkIns: {
          select: {
            date: true,
          },
          orderBy: { date: "desc" },
          take: 1,
        },
        _count: {
          select: {
            checkIns: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.userProgressionLevel.findMany({
      where: { userId: { in: friendIds } },
      select: {
        userId: true,
        logs: {
          select: {
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: {
          select: {
            logs: true,
          },
        },
      },
    }),
  ]);

  return { friendUsers, progressionLevels };
}

export async function getBasicUsers(friendIds: string[]) {
  return prisma.user.findMany({
    where: { id: { in: friendIds } },
    select: { id: true, name: true, username: true, createdAt: true, updatedAt: true },
    orderBy: { name: "asc" },
  });
}

export async function findFriendRequestById(requestId: string) {
  return prisma.friendRequest.findUnique({ where: { id: requestId } });
}

export async function listFriendRequestsByStatus(status: string) {
  return prisma.friendRequest.findMany({
    where: { status },
    include: {
      requester: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateFriendRequestStatus(requestId: string, status: string) {
  return prisma.friendRequest.update({
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
}

export async function resendFriendRequest(requestId: string, requesterId: string, receiverId: string) {
  return prisma.friendRequest.update({
    where: { id: requestId },
    data: {
      requesterId,
      receiverId,
      status: FRIEND_STATUS.PENDING,
      createdAt: new Date(),
      respondedAt: null,
    },
    include: {
      requester: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function createFriendRequest(requesterId: string, receiverId: string) {
  return prisma.friendRequest.create({
    data: {
      requesterId,
      receiverId,
      status: FRIEND_STATUS.PENDING,
    },
    include: {
      requester: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function deleteFriendRequest(requestId: string) {
  return prisma.friendRequest.delete({ where: { id: requestId } });
}

export async function cancelFriendRequest(requestId: string) {
  return prisma.friendRequest.update({
    where: { id: requestId },
    data: { status: FRIEND_STATUS.CANCELLED, respondedAt: new Date() },
  });
}

export async function findUserIdByLegacyIdentifier(identifier: string) {
  try {
    return await findFriendUserIdByFriendCode(identifier);
  } catch (error) {
    if (!isMissingFriendSchemaError(error)) {
      throw error;
    }
    const user = await prisma.user.findUnique({
      where: { id: identifier },
      select: { id: true },
    });
    return user?.id || null;
  }
}
