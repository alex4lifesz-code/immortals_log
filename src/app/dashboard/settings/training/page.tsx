"use client";

import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import {
  useDisplaySettings,
  type WeightUnitPref,
} from "@/context/DisplaySettingsContext";
import {
  CALENDAR_START_OPTIONS,
  SectionCard,
  SettingsSelectField,
  fieldShellStyle,
} from "../_shared";

export default function TrainingSettingsPage() {
  const { settings, updateSettings } = useDisplaySettings();
  const selectedWeekStart = CALENDAR_START_OPTIONS.find((option) => option.value === settings.calendarWeekStart);

  return (
    <PageLayout
      title="Training"
      subtitle="Preferred weight unit and training log defaults"
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
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Preview</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Bench Press • 20 {settings.defaultWeightUnit.toUpperCase()}</p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                History pages, summaries, and input flows will follow this default unit.
              </p>
              <p className="mt-3 text-[11px]" style={{ color: "var(--text-muted)" }}>Week start: {selectedWeekStart?.label ?? settings.calendarWeekStart}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </PageLayout>
  );
}
