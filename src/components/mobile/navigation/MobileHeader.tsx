"use client";

import type { ReactNode } from "react";
import MobileBackButton from "@/components/mobile/navigation/MobileBackButton";

interface MobileHeaderProps {
  title: string;
  rightSlot?: ReactNode;
}

export default function MobileHeader({ title, rightSlot }: MobileHeaderProps) {
  return (
    <header
      className="mobile-header-polish sticky top-0 z-30 safe-area-top mx-2 mt-2 flex min-h-14 items-center justify-between rounded-2xl border px-4"
      style={{
        background: "linear-gradient(180deg, color-mix(in srgb, var(--header-bg) 92%, var(--surface)) 0%, color-mix(in srgb, var(--surface) 94%, var(--ink-deep)) 100%)",
        borderColor: "color-mix(in srgb, var(--neon-border) 82%, var(--ink-light))",
      }}
    >
      <MobileBackButton />
      <h1 className="mobile-header-title max-w-[56vw] truncate text-base font-semibold tracking-[0.02em] text-cloud-white">{title}</h1>
      <div className="flex min-h-11 min-w-11 items-center justify-end">{rightSlot}</div>
    </header>
  );
}
