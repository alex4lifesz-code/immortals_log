"use client";

/**
 * Reusable loading skeleton for dashboard pages.
 * Renders placeholder shapes that mimic common page layouts.
 */

interface PageSkeletonProps {
  /** Number of stat cards in the top row */
  statCards?: number;
  /** Number of content rows below the stats */
  rows?: number;
  /** Whether to show a wide content block (e.g. calendar/table placeholder) */
  wideBlock?: boolean;
}

export default function PageSkeleton({ statCards = 4, rows = 3, wideBlock = true }: PageSkeletonProps) {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards row */}
      <div className={`grid grid-cols-2 md:grid-cols-${statCards} gap-3`}>
        {Array.from({ length: statCards }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-ink-light bg-ink-dark" />
        ))}
      </div>

      {/* Wide content block */}
      {wideBlock && (
        <div className="h-48 rounded-xl border border-ink-light bg-ink-dark" />
      )}

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg border border-ink-light bg-ink-dark" />
        ))}
      </div>
    </div>
  );
}
