"use client";

import type { CSSProperties, ReactNode } from "react";

export default function MobileCard({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`mobile-card-polish surface-panel surface-panel-strong rounded-2xl p-4 ${className}`} style={style}>
      {children}
    </section>
  );
}
