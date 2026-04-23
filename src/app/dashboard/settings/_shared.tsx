"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { CalendarWeekStartOption, DateFormatOption } from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";

export const THEME_OPTIONS: Array<{ value: Theme; label: string; desc: string }> = [
  { value: "discord", label: "Discord theme", desc: "Clean default canvas" },
  { value: "forest", label: "Forest", desc: "Everforest-inspired pine, sage & leaf — soft & balanced" },
  { value: "ink-dragon", label: "Ink Dragon", desc: "墨龙 — ink-wash charcoal, violet thunder & vermilion seal" },
  { value: "phoenix-bloom", label: "Phoenix Bloom", desc: "凤凰花 — ink-wash charcoal, amethyst purple & phoenix-pink blossom" },
  { value: "storm-chains", label: "Storm Chains", desc: "锁云 — storm-iron sky, lightning azure, silver chains & vermilion seal" },
  { value: "obsidian-ember", label: "Obsidian Ember", desc: "黑曜 — pure black & graphite grey with a single ember of crimson" },
  { value: "mist-cultivator", label: "Mist Cultivator", desc: "雾仙 — ink-mist greys, parchment-silver text & restrained violet sigil" },
  { value: "frost-sect", label: "Frost Sect", desc: "寒霜宗 — glacier slate, frost-pale silk & ice-cyan glow" },
  { value: "heavenly-sword", label: "Heavenly Sword", desc: "天剑 — dawn navy, cloud-white robes & sun-gold trim" },
];

export const DATE_OPTIONS: Array<{ value: DateFormatOption; label: string; sample: string }> = [
  { value: "dd-mm-yyyy", label: "DD-MM-YYYY", sample: "24-02-2026" },
  { value: "dd-mmm-yyyy", label: "DD-MMM-YYYY", sample: "24-Feb-2026" },
  { value: "dd-mm-yy", label: "DD-MM-YY", sample: "24-02-26" },
  { value: "dd-mmm-yy", label: "DD-MMM-YY", sample: "24-Feb-26" },
];

export const TIMEZONE_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "Australia/Melbourne", label: "Australia — Melbourne", desc: "AEDT / AEST" },
  { value: "Australia/Sydney", label: "Australia — Sydney", desc: "AEDT / AEST" },
  { value: "Pacific/Auckland", label: "New Zealand — Auckland", desc: "NZDT / NZST" },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam — Ho Chi Minh City", desc: "ICT (UTC+7)" },
  { value: "Asia/Bangkok", label: "Thailand — Bangkok", desc: "ICT (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore", desc: "SGT (UTC+8)" },
  { value: "UTC", label: "UTC", desc: "Coordinated Universal Time" },
];

export const CALENDAR_START_OPTIONS: Array<{ value: CalendarWeekStartOption; label: string; desc: string }> = [
  { value: "auto", label: "Auto", desc: "Match the selected region" },
  { value: "monday", label: "Monday", desc: "Common in AU, NZ, Vietnam" },
  { value: "sunday", label: "Sunday", desc: "Common in the US" },
];

export const sectionShellStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 62%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 10px 28px color-mix(in srgb, var(--void-black) 18%, transparent)",
};

export const summaryTileStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-mid) 64%, var(--ink-deep))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
};

export const fieldShellStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 46%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
};

export function SectionCard({
  eyebrow,
  title,
  description,
  badge,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border" style={sectionShellStyle}>
      <div className="border-b px-3.5 py-3 sm:px-4" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>{eyebrow}</p>
            <h2 className="mt-1 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
            {description ? <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{description}</p> : null}
          </div>
          {badge ? (
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                color: "var(--cloud-white)",
              }}
            >
              {badge}
            </span>
          ) : null}
        </div>
      </div>
      <div className="px-3.5 py-3 sm:px-4">{children}</div>
    </section>
  );
}

export function SettingsSummaryTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border px-3 py-2.5" style={summaryTileStyle}>
      <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
      {hint ? <p className="mt-1 line-clamp-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>{hint}</p> : null}
    </div>
  );
}

export function SettingsSelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; desc?: string }>;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <div className="rounded-xl border p-3" style={fieldShellStyle}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{label}</p>
          {selected?.desc ? <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{selected.desc}</p> : null}
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
            color: "var(--accent)",
          }}
        >
          Active
        </span>
      </div>

      <div className="relative">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full appearance-none rounded-lg border px-3 pr-10 text-sm outline-none transition-colors"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 55%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--void-black) 38%, var(--ink-dark))",
            color: "var(--text-primary)",
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
          style={{ color: "var(--text-muted)" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </div>
  );
}

export function SettingsNavRow({
  href,
  eyebrow,
  title,
  description,
  value,
  hint,
}: {
  href: string;
  eyebrow: string;
  title: string;
  description?: string;
  value: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 transition-colors hover:bg-[color-mix(in_srgb,var(--ink-mid)_72%,var(--ink-deep))] sm:px-4"
      style={sectionShellStyle}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--accent)" }}>{eyebrow}</p>
        <h2 className="mt-1 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
        {description ? <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{description}</p> : null}
        <p className="mt-2 truncate text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{value}</p>
        {hint ? <p className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{hint}</p> : null}
      </div>
      <svg
        className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5"
        style={{ color: "var(--text-muted)" }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
      </svg>
    </Link>
  );
}
