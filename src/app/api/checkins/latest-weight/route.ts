import { withAuth } from "@/lib/auth/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api";
import { findLatestWeightByUserId } from "@/lib/repositories/checkin.repository";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const latest = await findLatestWeightByUserId(auth.userId);

    if (!latest || latest.weight == null) {
      return apiSuccess({ weight: null, date: null });
    }

    return apiSuccess({ weight: latest.weight, date: latest.date });
  } catch (error) {
    console.error("Latest weight fetch error:", error);
    return ApiErrors.internal("Failed to fetch latest weight");
  }
});
