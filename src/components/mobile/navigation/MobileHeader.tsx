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
      className="mobile-header-polish sticky top-0 z-30 safe-area-top flex min-h-14 items-center justify-between border-b px-4"
      style={{ backgroundColor: "var(--header-bg)", borderBottomColor: "var(--neon-border)" }}
    >
      <MobileBackButton />
      <h1 className="mobile-header-title max-w-[56vw] truncate text-base font-semibold text-cloud-white">{title}</h1>
      <div className="flex min-h-11 min-w-11 items-center justify-end">{rightSlot}</div>
    </header>
  );
}
