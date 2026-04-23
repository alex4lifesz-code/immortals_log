"use client";

import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import {
  useDisplaySettings,
  type CalendarWeekStartOption,
  type DateFormatOption,
} from "@/context/DisplaySettingsContext";
import {
  CALENDAR_START_OPTIONS,
  DATE_OPTIONS,
  SectionCard,
  SettingsSelectField,
  TIMEZONE_OPTIONS,
} from "../_shared";

export default function CalendarSettingsPage() {
  const { settings, updateSettings } = useDisplaySettings();

  return (
    <PageLayout
      title="Date and region"
      subtitle="Keep history, schedules, and logs aligned"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--accent)" }}
        >
          <span aria-hidden="true">←</span> Back to Settings
        </Link>

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
      </div>
    </PageLayout>
  );
}
