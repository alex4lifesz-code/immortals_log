"use client";

import type { ReactNode } from "react";
import MobileSwipeableRow from "@/components/mobile/lists/MobileSwipeableRow";

interface MobileListItemProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export default function MobileListItem({ title, subtitle, left, right, onSwipeLeft, onSwipeRight }: MobileListItemProps) {
  return (
    <MobileSwipeableRow onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
      <article className="mobile-card-polish flex min-h-14 items-center justify-between gap-3 rounded-xl border border-border bg-ink-deep px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {left}
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-cloud-white">{title}</h4>
            {subtitle ? <p className="truncate text-xs text-mist-light">{subtitle}</p> : null}
          </div>
        </div>
        {right}
      </article>
    </MobileSwipeableRow>
  );
}
