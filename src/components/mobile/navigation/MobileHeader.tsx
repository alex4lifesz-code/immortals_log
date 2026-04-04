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
      className="sticky top-0 z-30 flex min-h-14 items-center justify-between border-b border-border px-4 backdrop-blur-sm"
      style={{ backgroundColor: "var(--header-bg)", borderBottomColor: "var(--header-border)" }}
    >
      <MobileBackButton />
      <h1 className="max-w-[56vw] truncate text-base font-semibold text-cloud-white">{title}</h1>
      <div className="flex min-h-11 min-w-11 items-center justify-end">{rightSlot}</div>
    </header>
  );
}
