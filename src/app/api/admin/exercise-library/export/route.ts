import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/middleware";

export const GET = withAdmin(async () => {
  return NextResponse.json(
    {
      error: "Legacy exercise-library export has been removed. Rebuild the new backup flow from the blank canvas.",
    },
    { status: 410 },
  );
});
