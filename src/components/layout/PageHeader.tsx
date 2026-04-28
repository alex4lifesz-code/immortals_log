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
      className={`flex items-end justify-between gap-3 ${noBorder ? "" : "border-b"} ${className}`}
      style={
        noBorder
          ? undefined
          : {
              borderBottomColor:
                "color-mix(in srgb, var(--ink-light) 42%, transparent)",
            }
      }
    >
      <div className="min-w-0">
        <p
          className="text-[9px] uppercase tracking-[0.1em]"
          style={{ color: "var(--text-muted)" }}
        >
          {eyebrow}
        </p>
        <h2
          className="mt-0.5 text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--text-primary)" }}
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
