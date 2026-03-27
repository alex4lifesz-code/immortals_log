"use client";

interface ExerciseImageBoxProps {
  className?: string;
  compact?: boolean;
}

export default function ExerciseImageBox({ className = "", compact = false }: ExerciseImageBoxProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border border-jade-glow/25 bg-gradient-to-br from-ink-mid/60 via-jade-deep/20 to-ink-mid/60 ${compact ? "h-9 w-9" : "h-12 w-12"} ${className}`}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,color-mix(in_srgb,var(--jade-glow)_22%,transparent),transparent_60%)]" />
      <div className="absolute inset-x-1.5 bottom-1.5 h-px bg-jade-glow/35" />
      <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-jade-glow/35" />
    </div>
  );
}
