"use client";

import type { ReactNode } from "react";
import MobileSwipeableRow from "@/components/mobile/lists/MobileSwipeableRow";

interface MobileListItemProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export default function MobileListItem({ title, subtitle, right, onSwipeLeft, onSwipeRight }: MobileListItemProps) {
  return (
    <MobileSwipeableRow onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
      <article className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-ink-deep px-4 py-3">
        <div>
          <h4 className="text-sm font-semibold text-cloud-white">{title}</h4>
          {subtitle ? <p className="text-xs text-mist-light">{subtitle}</p> : null}
        </div>
        {right}
      </article>
    </MobileSwipeableRow>
  );
}
