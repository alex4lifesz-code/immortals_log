import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import { FRIEND_STATUS, getAcceptedFriendIds, getFriendRequestBetweenUsers, isMissingFriendSchemaError } from "@/lib/friends";
import { generateUniqueImmortalFriendCode, isImmortalFriendCode, normalizeFriendCode } from "@/lib/friend-code";
import {
  cancelFriendRequest,
  createFriendRequest,
  deleteFriendRequest,
  findFriendRequestById,
  findFriendUserById,
  findUserIdByLegacyIdentifier,
  getFriendsWithStats,
  getPendingIncomingRequests,
  getPendingOutgoingRequests,
  getUserIdentityById,
  isUniqueConstraintError,
  resendFriendRequest,
  updateFriendRequestStatus,
  updateUserFriendCode,
  getBasicUsers,
} from "@/lib/repositories/friend.repository";

const IMMORTAL_FRIEND_CODE_FORMAT_EXAMPLE = "immortal1234";

function sanitizeAction(action: unknown): "accept" | "reject" {
  return action === "accept" ? "accept" : "reject";
}

function parseJsonObject(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function getShareableIdentity(userId: string) {
  try {
    const current = await getUserIdentityById(userId);

    if (!current) {
      return { id: userId, friendCode: userId };
    }

    const normalizedCurrentFriendCode = normalizeFriendCode(current.friendCode);
    if (isImmortalFriendCode(normalizedCurrentFriendCode)) {
      if (current.friendCode !== normalizedCurrentFriendCode) {
        const normalized = await updateUserFriendCode(userId, normalizedCurrentFriendCode);
        return { id: normalized.id, friendCode: normalized.friendCode || normalizedCurrentFriendCode };
      }

      return { id: current.id, friendCode: normalizedCurrentFriendCode };
    }

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const nextFriendCode = await generateUniqueImmortalFriendCode();
      try {
        const updated = await updateUserFriendCode(userId, nextFriendCode);

        return { id: updated.id, friendCode: updated.friendCode || nextFriendCode };
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Unable to assign a unique friend code");
  } catch (error) {
    if (isMissingFriendSchemaError(error)) {
      return { id: userId, friendCode: userId };
    }
    throw error;
  }
}

async function findTargetUserId(identifier: string) {
  const normalizedIdentifier = normalizeFriendCode(identifier);
  if (!isImmortalFriendCode(normalizedIdentifier)) {
    return null;
  }

  return findUserIdByLegacyIdentifier(normalizedIdentifier || identifier);
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
        getPendingIncomingRequests(userId),
        getPendingOutgoingRequests(userId),
      ]);
    } catch (error) {
      if (!isMissingFriendSchemaError(error)) {
        throw error;
      }
    }

    let friends: Array<{
      id: string;
      name: string;
      username: string;
      friendCode?: string | null;
      createdAt?: Date;
      updatedAt?: Date;
      sessionCount?: number;
      checkInCount?: number;
      lastWorkoutAt?: Date | null;
      lastCheckInAt?: Date | null;
      lastActivityAt?: string | null;
      lastActivityLabel?: string | null;
      themeStyle?: string | null;
    }> = [];
    if (friendIds.length) {
      try {
        const { friendUsers, progressionLevels } = await getFriendsWithStats(friendIds);

        const progressionLogCounts = new Map<string, number>();
        const lastWorkoutAtByUser = new Map<string, Date>();
        for (const level of progressionLevels) {
          progressionLogCounts.set(level.userId, (progressionLogCounts.get(level.userId) ?? 0) + level._count.logs);

          const latestLogAt = level.logs[0]?.createdAt;
          const currentLatest = lastWorkoutAtByUser.get(level.userId);
          if (latestLogAt && (!currentLatest || latestLogAt.getTime() > currentLatest.getTime())) {
            lastWorkoutAtByUser.set(level.userId, latestLogAt);
          }
        }

        friends = friendUsers.map((friend) => {
          const appPrefs = parseJsonObject(friend.settings?.pinnedNavItems);

          return {
            id: friend.id,
            name: friend.name,
            username: friend.username,
            friendCode: friend.friendCode,
            createdAt: friend.createdAt,
            updatedAt: friend.updatedAt,
            sessionCount: progressionLogCounts.get(friend.id) ?? 0,
            checkInCount: friend._count.checkIns,
            lastWorkoutAt: lastWorkoutAtByUser.get(friend.id) ?? null,
            lastCheckInAt: friend.checkIns[0]?.date ?? null,
            lastActivityAt: typeof appPrefs?.lastActivityAt === "string" ? appPrefs.lastActivityAt : null,
            lastActivityLabel: typeof appPrefs?.lastActivityLabel === "string" ? appPrefs.lastActivityLabel : null,
            themeStyle: typeof appPrefs?.themeStyle === "string" ? appPrefs.themeStyle : null,
          };
        });
      } catch (error) {
        if (isMissingFriendSchemaError(error)) {
          friends = await getBasicUsers(friendIds);
        } else {
          throw error;
        }
      }
    }

    return apiSuccess({
      me,
      friends,
      incomingRequests: incoming,
      outgoingRequests: outgoing,
    });
  } catch (error) {
    console.error("Friends fetch error:", error);
    return ApiErrors.internal("Failed to fetch friends");
  }
});

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { toUserId, friendCode } = await request.json();
    const normalizedFriendCode = normalizeFriendCode(friendCode);

    if ((!toUserId || typeof toUserId !== "string") && !normalizedFriendCode) {
      return ApiErrors.badRequest("friendCode is required");
    }

    if (!toUserId && normalizedFriendCode && !isImmortalFriendCode(normalizedFriendCode)) {
      return ApiErrors.badRequest(`Friend ID format is invalid. Use ${IMMORTAL_FRIEND_CODE_FORMAT_EXAMPLE}.`);
    }

    let targetUserId = typeof toUserId === "string" ? toUserId : "";

    if (!targetUserId && normalizedFriendCode) {
      targetUserId = await findTargetUserId(normalizedFriendCode) || "";
      if (!targetUserId) {
        return ApiErrors.notFound("No user found for that friend ID");
      }
    }

    if (targetUserId === auth.userId) {
      return ApiErrors.badRequest("You cannot send a request to yourself");
    }

    const target = await findFriendUserById(targetUserId);
    if (!target) {
      return ApiErrors.notFound("User not found");
    }

    const existing = await getFriendRequestBetweenUsers(auth.userId, targetUserId);
    if (existing) {
      if (existing.status === FRIEND_STATUS.ACCEPTED) {
        return ApiErrors.conflict("You are already friends");
      }

      if (existing.status === FRIEND_STATUS.PENDING) {
        return ApiErrors.conflict("A pending request already exists");
      }

      const updated = await resendFriendRequest(existing.id, auth.userId, targetUserId);

      return apiSuccess({ request: updated, resent: true });
    }

    const created = await createFriendRequest(auth.userId, targetUserId);

    return apiSuccess({ request: created, resent: false });
  } catch (error) {
    console.error("Friend request create error:", error);
    return ApiErrors.internal("Failed to send request");
  }
});

export const PATCH = withAuth(async (request, { auth }) => {
  try {
    const { requestId, action } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return ApiErrors.badRequest("requestId is required");
    }

    const requestRow = await findFriendRequestById(requestId);
    if (!requestRow) {
      return ApiErrors.notFound("Request not found");
    }

    if (requestRow.receiverId !== auth.userId) {
      return ApiErrors.forbidden("Only the receiver can respond");
    }

    if (requestRow.status !== FRIEND_STATUS.PENDING) {
      return ApiErrors.conflict("Request is not pending");
    }

    const normalizedAction = sanitizeAction(action);
    const nextStatus = normalizedAction === "accept" ? FRIEND_STATUS.ACCEPTED : FRIEND_STATUS.REJECTED;

    const updated = await updateFriendRequestStatus(requestId, nextStatus);

    return apiSuccess({ request: updated });
  } catch (error) {
    console.error("Friend request response error:", error);
    return ApiErrors.internal("Failed to respond to request");
  }
});

export const DELETE = withAuth(async (request, { auth }) => {
  try {
    const body = await request.json().catch(() => ({}));
    const requestId = typeof body.requestId === "string" ? body.requestId : null;
    const friendUserId = typeof body.friendUserId === "string" ? body.friendUserId : null;

    if (requestId) {
      const row = await findFriendRequestById(requestId);
      if (!row) {
        return ApiErrors.notFound("Request not found");
      }

      const isParticipant = row.requesterId === auth.userId || row.receiverId === auth.userId;
      if (!isParticipant) {
        return ApiErrors.forbidden("Not allowed");
      }

      if (row.status === FRIEND_STATUS.ACCEPTED) {
        await deleteFriendRequest(requestId);
      } else {
        await cancelFriendRequest(requestId);
      }

      return apiSuccess({ success: true });
    }

    if (!friendUserId) {
      return ApiErrors.badRequest("requestId or friendUserId is required");
    }

    const relation = await getFriendRequestBetweenUsers(auth.userId, friendUserId);
    if (!relation) {
      return ApiErrors.notFound("Friend relationship not found");
    }

    if (relation.status === FRIEND_STATUS.ACCEPTED) {
      await deleteFriendRequest(relation.id);
    } else {
      await cancelFriendRequest(relation.id);
    }

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Friend request delete error:", error);
    return ApiErrors.internal("Failed to cancel/remove relationship");
  }
});
