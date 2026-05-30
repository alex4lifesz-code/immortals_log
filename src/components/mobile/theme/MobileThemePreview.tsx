"use client";

interface MobileThemePreviewProps {
  title: string;
  colors: string[];
  active: boolean;
  onClick: () => void;
  favorite?: boolean;
}

export default function MobileThemePreview({ title, colors, active, onClick, favorite = false }: MobileThemePreviewProps) {
  return (
    <button
      onClick={onClick}
      className={`polished-focus touch-manipulation rounded-2xl border p-3 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 ${active ? "border-jade-glow bg-ink-mid/70" : "border-border bg-ink-deep"}`}
      aria-pressed={active}
      aria-label={`Select theme ${title}`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-cloud-white">{title}</span>
        {favorite ? <span className="text-[11px] text-gold-glow">Preferred</span> : null}
      </div>
      <div className="flex gap-1.5">
        {colors.map((color) => (
          <span key={color} className="h-7 w-7 rounded-full border border-cloud-white/20" style={{ backgroundColor: color }} />
        ))}
      </div>
    </button>
  );
}
