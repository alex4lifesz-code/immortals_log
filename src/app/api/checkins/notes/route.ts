import { withAuth } from "@/lib/auth/middleware";
import { getVisibleSocialUserIds, normalizeScope } from "@/lib/friends";
import { apiSuccess, ApiErrors } from "@/lib/api";
import {
  createCheckinNote,
  deleteCheckinNoteById,
  findCheckinNoteByDateAndUser,
  findCheckinNoteById,
  findCheckinNotes,
  updateCheckinNoteContent,
  updateCheckinNotePinned,
} from "@/lib/repositories/checkin.repository";

// GET /api/checkins/notes?date=YYYY-MM-DD  — fetch current user's notes for a date (or all if no date)
// GET /api/checkins/notes?future=true — fetch notes for dates beyond today
export const GET = withAuth(async (request, { auth }) => {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const future = searchParams.get("future");
    const scope = normalizeScope(
      searchParams.get("scope"),
      auth.role === "admin" ? "community" : "friends"
    );
    const clientToday = searchParams.get("today");

    const visibleUserIds = await getVisibleSocialUserIds({
      viewerId: auth.userId,
      viewerRole: auth.role,
      scope,
    });

    let dateFilter: string | undefined;
    let futureToday: string | undefined;
    if (future === "true") {
      const todayStr = clientToday && /^\d{4}-\d{2}-\d{2}$/.test(clientToday)
        ? clientToday
        : (() => { const today = new Date(); return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`; })();
      futureToday = todayStr;
    } else if (date) {
      dateFilter = date;
    }

    const notes = await findCheckinNotes({
      userIds: visibleUserIds,
      date: dateFilter,
      futureToday,
    });

    return apiSuccess({ notes });
  } catch (error) {
    console.error("CheckInNote fetch error:", error);
    return ApiErrors.internal("Failed to fetch notes");
  }
});

// POST /api/checkins/notes — create a new note
export const POST = withAuth(async (request, { auth }) => {
  try {
    const { date, content } = await request.json();
    const userId = auth.userId;

    if (!date || !content?.trim()) {
      return ApiErrors.badRequest("Date and content are required");
    }

    // Validate date format
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return ApiErrors.badRequest("Invalid date format (expected YYYY-MM-DD)");
    }

    const trimmedContent = String(content).trim().slice(0, 2000);

    const existing = await findCheckinNoteByDateAndUser(date, userId);

    const note = existing
      ? await updateCheckinNoteContent(existing.id, trimmedContent)
      : await createCheckinNote({
          date,
          userId,
          content: trimmedContent,
        });

    return apiSuccess({ note, updated: Boolean(existing) });
  } catch (error) {
    console.error("CheckInNote create error:", error);
    return ApiErrors.internal("Failed to create note");
  }
});

// PATCH /api/checkins/notes — toggle pin on a note
export const PATCH = withAuth(async (request, { auth }) => {
  try {
    const { noteId, pinned } = await request.json();

    if (!noteId) {
      return ApiErrors.badRequest("noteId is required");
    }

    // Verify ownership
    const existing = await findCheckinNoteById(noteId);

    if (!existing || existing.userId !== auth.userId) {
      return ApiErrors.forbidden("Note not found or not owned by user");
    }

    const note = await updateCheckinNotePinned(noteId, typeof pinned === "boolean" ? pinned : !existing.pinned);

    return apiSuccess({ note });
  } catch (error) {
    console.error("CheckInNote pin error:", error);
    return ApiErrors.internal("Failed to update note");
  }
});

// DELETE /api/checkins/notes — delete a note (owner only)
export const DELETE = withAuth(async (request, { auth }) => {
  try {
    const { noteId } = await request.json();

    if (!noteId) {
      return ApiErrors.badRequest("noteId is required");
    }

    // Verify ownership
    const existing = await findCheckinNoteById(noteId);

    if (!existing || existing.userId !== auth.userId) {
      return ApiErrors.forbidden("Note not found or not owned by user");
    }

    await deleteCheckinNoteById(noteId);

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("CheckInNote delete error:", error);
    return ApiErrors.internal("Failed to delete note");
  }
});
