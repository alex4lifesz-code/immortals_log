import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAuth } from "@/lib/auth/middleware";
import {
  deleteProgressionLogById,
  findProgressionLogWithOwner,
} from "@/lib/repositories/progression.repository";

export const POST = withAuth(async (request, { auth }) => {
  try {
    const { logId } = await request.json();

    if (!logId || typeof logId !== "string") {
      return ApiErrors.badRequest("logId is required");
    }

    // Find the log and verify ownership
    const log = await findProgressionLogWithOwner(logId);

    if (!log) {
      return ApiErrors.notFound("Log record not found");
    }

    if (log.userProgression.userId !== auth.userId) {
      return ApiErrors.forbidden("Unauthorized");
    }

    await deleteProgressionLogById(logId);

    return apiSuccess({ success: true, message: "Log record deleted successfully" });
  } catch (error) {
    console.error("Progression log delete error:", error);
    return ApiErrors.internal("Failed to delete log record");
  }
});
