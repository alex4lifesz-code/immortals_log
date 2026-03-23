"use client";

interface MobileProgressRingProps {
  progress: number;
  label?: string;
  valueText?: string;
}

export default function MobileProgressRing({ progress, label, valueText }: MobileProgressRingProps) {
  const normalized = Math.max(0, Math.min(100, progress));
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (normalized / 100) * circumference;

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={normalized}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || "Progress"}
    >
      <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
        <circle cx="60" cy="60" r={radius} className="fill-none stroke-ink-mid" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className="fill-none stroke-jade-glow transition-all duration-500"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-bold text-cloud-white">{valueText ?? `${Math.round(normalized)}%`}</div>
        {label ? <div className="text-[11px] text-mist-light">{label}</div> : null}
      </div>
    </div>
  );
}
