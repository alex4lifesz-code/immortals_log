"use client";

interface CultivationRealmBadgeProps {
  realm: string;
}

export default function CultivationRealmBadge({ realm }: CultivationRealmBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold-dim/20 px-3 py-1 text-xs font-semibold text-gold-glow">
      {realm}
    </span>
  );
}
