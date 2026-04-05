"use client";

import type { ReactNode } from "react";

export default function MobileCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mobile-card-polish rounded-2xl border border-border bg-ink-deep p-4 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${className}`}>{children}</section>;
}
