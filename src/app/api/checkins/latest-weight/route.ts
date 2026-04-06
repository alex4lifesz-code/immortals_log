import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth/middleware";
import { apiSuccess, ApiErrors } from "@/lib/api";

export const GET = withAuth(async (_request, { auth }) => {
  try {
    const latest = await prisma.checkIn.findFirst({
      where: {
        userId: auth.userId,
        weight: { not: null },
      },
      orderBy: { date: "desc" },
      select: { weight: true, date: true },
    });

    if (!latest || latest.weight == null) {
      return apiSuccess({ weight: null, date: null });
    }

    return apiSuccess({ weight: latest.weight, date: latest.date });
  } catch (error) {
    console.error("Latest weight fetch error:", error);
    return ApiErrors.internal("Failed to fetch latest weight");
  }
});
