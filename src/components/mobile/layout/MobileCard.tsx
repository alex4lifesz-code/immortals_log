"use client";

import type { ReactNode } from "react";

export default function MobileCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`mobile-card-polish surface-panel surface-panel-strong rounded-2xl p-4 ${className}`}>{children}</section>;
}
