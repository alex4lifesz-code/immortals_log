"use client";

export default function MobileLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-ink-dark" />
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-ink-dark" />
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-ink-dark" />
    </div>
  );
}
