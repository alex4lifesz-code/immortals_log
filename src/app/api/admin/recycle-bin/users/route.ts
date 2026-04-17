import { apiSuccess, ApiErrors } from "@/lib/api";
import { withAdmin } from "@/lib/auth/middleware";
import {
  listDeletedUsers,
  permanentlyDeleteArchivedUser,
  restoreDeletedUser,
} from "@/lib/user-recycle-bin";

export const GET = withAdmin(async () => {
  try {
    const users = await listDeletedUsers();
    return apiSuccess({ users });
  } catch (error) {
    console.error("Recycle bin list error:", error);
    return ApiErrors.internal("Failed to load recycle bin users");
  }
});

export const POST = withAdmin(async (request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { archiveId?: string };
    if (!body.archiveId) {
      return ApiErrors.badRequest("archiveId is required");
    }

    const restored = await restoreDeletedUser(body.archiveId);
    return apiSuccess({
      user: restored,
      message: `${restored.name} was restored from the recycle bin.`,
    });
  } catch (error) {
    console.error("Recycle bin restore error:", error);
    return ApiErrors.badRequest(error instanceof Error ? error.message : "Failed to restore archived user");
  }
});

export const DELETE = withAdmin(async (request) => {
  try {
    const body = (await request.json().catch(() => ({}))) as { archiveId?: string; confirm?: boolean };
    if (!body.archiveId) {
      return ApiErrors.badRequest("archiveId is required");
    }
    if (body.confirm !== true) {
      return ApiErrors.badRequest("Confirmation is required before permanent deletion");
    }

    const deleted = await permanentlyDeleteArchivedUser(body.archiveId);
    return apiSuccess({
      user: deleted,
      message: `${deleted.name} was permanently deleted from the recycle bin.`,
    });
  } catch (error) {
    console.error("Recycle bin permanent delete error:", error);
    return ApiErrors.badRequest(error instanceof Error ? error.message : "Failed to permanently delete archived user");
  }
});
