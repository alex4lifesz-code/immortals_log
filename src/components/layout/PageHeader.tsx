"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  actions?: ReactNode;
  /** Extra className applied to the wrapper */
  className?: string;
  /** When true, renders without the bottom border and border-color style (embed inside a section that has its own divider) */
  noBorder?: boolean;
}

/**
 * Reusable page-level header that mirrors the DashboardCalendar header style.
 * Provides an eyebrow label, a prominent title, and an optional right-side actions slot.
 *
 * Usage:
 *   <PageHeader eyebrow="CIRCLE" title="Feed" actions={<SomeButton />} />
 */
export default function PageHeader({
  eyebrow,
  title,
  actions,
  className = "",
  noBorder = false,
}: PageHeaderProps) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ${noBorder ? "" : "border"} flex items-end justify-between gap-3 ${className}`}
      style={{
        borderColor: noBorder ? "transparent" : "color-mix(in srgb, var(--ink-light) 52%, transparent)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--surface-hover) 42%, var(--surface)) 0%, color-mix(in srgb, var(--surface) 96%, transparent) 100%)",
      }}
    >
      <div className="min-w-0">
        <p
          className="inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]"
          style={{
            color: "var(--text-secondary)",
            borderColor: "color-mix(in srgb, var(--accent) 40%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
          }}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-1 text-sm font-semibold uppercase tracking-[0.09em]"
          style={{
            color: "var(--text-primary)",
            textShadow: "0 0 10px color-mix(in srgb, var(--accent) 16%, transparent)",
          }}
        >
          {title}
        </h2>
      </div>
      {actions && (
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
