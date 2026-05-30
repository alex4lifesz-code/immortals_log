import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAdmin } from "@/lib/auth/middleware";
import { FRIEND_STATUS } from "@/lib/friends";
import {
  findFriendRequestById,
  listFriendRequestsByStatus,
  updateFriendRequestStatus,
} from "@/lib/repositories/friend.repository";

export const GET = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status = typeof statusParam === "string" && statusParam.trim() ? statusParam.trim() : FRIEND_STATUS.PENDING;

    const requests = await listFriendRequestsByStatus(status);

    return apiSuccess({ requests });
  } catch (error) {
    console.error("Admin friend requests fetch error:", error);
    return ApiErrors.internal("Failed to fetch friend requests");
  }
});

export const PATCH = withAdmin(async (request) => {
  try {
    const { requestId, status } = await request.json();

    if (!requestId || typeof requestId !== "string") {
      return ApiErrors.badRequest("requestId is required");
    }

    if (status !== FRIEND_STATUS.ACCEPTED && status !== FRIEND_STATUS.REJECTED && status !== FRIEND_STATUS.CANCELLED) {
      return ApiErrors.badRequest("Invalid status");
    }

    const existing = await findFriendRequestById(requestId);
    if (!existing) {
      return ApiErrors.notFound("Request not found");
    }

    const updated = await updateFriendRequestStatus(requestId, status);

    return apiSuccess({ request: updated });
  } catch (error) {
    console.error("Admin friend request update error:", error);
    return ApiErrors.internal("Failed to update request");
  }
});
