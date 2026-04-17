import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/auth/middleware";

export const POST = withAdmin(async () => {
  return NextResponse.json(
    {
      error: "Legacy exercise-library import has been removed. Rebuild the new restore flow from the blank canvas.",
    },
    { status: 410 },
  );
});
