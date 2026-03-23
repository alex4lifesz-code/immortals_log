"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="rounded-lg border border-crimson/30 bg-crimson-deep/10 px-6 py-5 max-w-md">
        <h2 className="text-sm font-semibold text-crimson-light mb-2">Something went wrong</h2>
        <p className="text-xs text-mist-light mb-4 leading-relaxed">
          {error.message || "An unexpected error occurred while loading this page."}
        </p>
        <button
          onClick={reset}
          className="rounded-md border border-jade-glow/40 bg-jade-deep/10 px-4 py-2 text-xs font-semibold text-jade-light transition-colors hover:bg-jade-deep/20 hover:border-jade-glow/60"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
