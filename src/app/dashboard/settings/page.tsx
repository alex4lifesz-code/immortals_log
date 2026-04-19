"use client";

import type { ReactNode } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  type CalendarWeekStartOption,
  type DateFormatOption,
  type WeightUnitPref,
} from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";

const THEME_OPTIONS: Array<{ value: Theme; label: string; desc: string }> = [
  { value: "discord", label: "Discord theme", desc: "Clean default canvas" },
];

const DATE_OPTIONS: Array<{ value: DateFormatOption; label: string; sample: string }> = [
  { value: "dd-mm-yyyy", label: "DD-MM-YYYY", sample: "24-02-2026" },
  { value: "dd-mmm-yyyy", label: "DD-MMM-YYYY", sample: "24-Feb-2026" },
  { value: "dd-mm-yy", label: "DD-MM-YY", sample: "24-02-26" },
  { value: "dd-mmm-yy", label: "DD-MMM-YY", sample: "24-Feb-26" },
];

const TIMEZONE_OPTIONS: Array<{ value: string; label: string; desc: string }> = [
  { value: "Australia/Melbourne", label: "Australia — Melbourne", desc: "AEDT / AEST" },
  { value: "Australia/Sydney", label: "Australia — Sydney", desc: "AEDT / AEST" },
  { value: "Pacific/Auckland", label: "New Zealand — Auckland", desc: "NZDT / NZST" },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam — Ho Chi Minh City", desc: "ICT (UTC+7)" },
  { value: "Asia/Bangkok", label: "Thailand — Bangkok", desc: "ICT (UTC+7)" },
  { value: "Asia/Singapore", label: "Singapore", desc: "SGT (UTC+8)" },
  { value: "UTC", label: "UTC", desc: "Coordinated Universal Time" },
];

const CALENDAR_START_OPTIONS: Array<{ value: CalendarWeekStartOption; label: string; desc: string }> = [
  { value: "auto", label: "Auto", desc: "Match the selected region" },
  { value: "monday", label: "Monday", desc: "Common in AU, NZ, Vietnam" },
  { value: "sunday", label: "Sunday", desc: "Common in the US" },
];

const sectionShellStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 62%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-deep) 92%, var(--ink-mid))",
  boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 10px 28px color-mix(in srgb, var(--void-black) 18%, transparent)",
};

const summaryTileStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-mid) 64%, var(--ink-deep))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
};

const fieldShellStyle = {
  borderColor: "color-mix(in srgb, var(--ink-light) 46%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
};

function SectionCard({
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea1ff]">{eyebrow}</p>
            <h2 className="mt-1 text-[15px] font-semibold text-[#f2f3f5]">{title}</h2>
            {description ? <p className="mt-1 text-[11px] text-[#b5bac1]">{description}</p> : null}
          </div>
          {badge ? (
            <span
              className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 28%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                color: "#dbe3ff",
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

function SettingsSummaryTile({
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
      <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{value}</p>
      {hint ? <p className="mt-1 line-clamp-2 text-[11px] text-[#b5bac1]">{hint}</p> : null}
    </div>
  );
}

function SettingsSelectField({
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
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">{label}</p>
          {selected?.desc ? <p className="mt-1 text-[11px] text-[#b5bac1]">{selected.desc}</p> : null}
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#c9d2ff]"
          style={{
            borderColor: "color-mix(in srgb, var(--accent) 24%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
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
            color: "#f2f3f5",
          }}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#949ba4]"
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

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const selectedTheme = THEME_OPTIONS.find((theme) => theme.value === themeStyle);
  const selectedDateFormat = DATE_OPTIONS.find((option) => option.value === settings.dateFormat);
  const selectedTimeZone = TIMEZONE_OPTIONS.find((zone) => zone.value === settings.timeZone);
  const selectedWeekStart = CALENDAR_START_OPTIONS.find((option) => option.value === settings.calendarWeekStart);

  return (
    <PageLayout
      title="Settings"
      subtitle="Clean defaults for appearance, dates, and training"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <SectionCard
          eyebrow="Control room"
          title={user?.name || "Cultivator"}
          description="The key preferences are now grouped into a cleaner, more consistent layout."
          badge="Live"
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <SettingsSummaryTile
              label="Theme"
              value={selectedTheme?.label ?? themeStyle}
              hint={selectedTheme?.desc}
            />
            <SettingsSummaryTile
              label="Date format"
              value={selectedDateFormat?.label ?? settings.dateFormat}
              hint={selectedDateFormat?.sample}
            />
            <SettingsSummaryTile
              label="Timezone"
              value={selectedTimeZone?.label ?? settings.timeZone}
              hint={selectedTimeZone?.desc}
            />
            <SettingsSummaryTile
              label="Weight unit"
              value={settings.defaultWeightUnit.toUpperCase()}
              hint="Used across training logs and history"
            />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Appearance" title="Theme" description="Discord is now the single fixed app canvas." badge="Visual">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <SettingsSelectField
              label="Theme style"
              value={themeStyle}
              onChange={(value) => setThemeStyle(value as Theme)}
              options={THEME_OPTIONS.map((theme) => ({ value: theme.value, label: theme.label, desc: theme.desc }))}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Current look</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{selectedTheme?.label ?? themeStyle}</p>
              <p className="mt-1 text-[11px] text-[#b5bac1]">{selectedTheme?.desc ?? "Palette synced across the entire app shell."}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-mid)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-light)" }} />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Calendar" title="Date and region" description="Keep history, schedules, and logs aligned everywhere." badge="Sync">
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingsSelectField
              label="Timezone"
              value={settings.timeZone}
              onChange={(value) => updateSettings({ timeZone: value })}
              options={TIMEZONE_OPTIONS.map((option) => ({ value: option.value, label: option.label, desc: option.desc }))}
            />
            <SettingsSelectField
              label="Date format"
              value={settings.dateFormat}
              onChange={(value) => updateSettings({ dateFormat: value as DateFormatOption })}
              options={DATE_OPTIONS.map((option) => ({ value: option.value, label: option.label, desc: option.sample }))}
            />
            <SettingsSelectField
              label="Week starts on"
              value={settings.calendarWeekStart}
              onChange={(value) => updateSettings({ calendarWeekStart: value as CalendarWeekStartOption })}
              options={CALENDAR_START_OPTIONS.map((option) => ({ value: option.value, label: option.label, desc: option.desc }))}
            />
          </div>
        </SectionCard>

        <SectionCard eyebrow="Training" title="Weight unit" description="Set it once and keep every session log readable." badge="Log">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <SettingsSelectField
              label="Preferred weight unit"
              value={settings.defaultWeightUnit}
              onChange={(value) => updateSettings({ defaultWeightUnit: value as WeightUnitPref })}
              options={[
                { value: "kg", label: "Kilograms (kg)", desc: "Best for metric-based training logs" },
                { value: "lbs", label: "Pounds (lbs)", desc: "Best for imperial-based training logs" },
              ]}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Preview</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">Bench Press • 20 {settings.defaultWeightUnit.toUpperCase()}</p>
              <p className="mt-1 text-[11px] text-[#b5bac1]">
                History pages, summaries, and input flows will follow this default unit.
              </p>
              <p className="mt-3 text-[11px] text-[#949ba4]">Week start: {selectedWeekStart?.label ?? settings.calendarWeekStart}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Account"
          title="Session"
          description="Sign out without losing the local display choices already saved on this device."
          badge={user?.username ? `@${user.username}` : undefined}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[12px] text-[#dbdee1]">Everything important stays tidy and easier to scan now.</p>
              <p className="mt-1 text-[11px] text-[#949ba4]">Signed in as {user?.name ?? "Cultivator"}.</p>
            </div>
            <GlowButton variant="crimson" onClick={logout} className="w-full sm:w-auto">
              Logout
            </GlowButton>
          </div>
        </SectionCard>
      </div>
    </PageLayout>
  );
}
