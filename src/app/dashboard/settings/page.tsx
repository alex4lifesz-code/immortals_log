"use client";

import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import {
  CALENDAR_START_OPTIONS,
  DATE_OPTIONS,
  SectionCard,
  SettingsNavRow,
  SettingsSummaryTile,
  THEME_OPTIONS,
  TIMEZONE_OPTIONS,
} from "./_shared";

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, themeMode } = useAppContext();
  const { settings } = useDisplaySettings();
  const selectedTheme = THEME_OPTIONS.find((theme) => theme.value === themeStyle);
  const selectedDateFormat = DATE_OPTIONS.find((option) => option.value === settings.dateFormat);
  const selectedTimeZone = TIMEZONE_OPTIONS.find((zone) => zone.value === settings.timeZone);
  const selectedWeekStart = CALENDAR_START_OPTIONS.find((option) => option.value === settings.calendarWeekStart);
  const modeLabel = themeMode === "light" ? "Light" : themeMode === "dark" ? "Dark" : "Auto";

  return (
    <PageLayout
      title="Settings"
      subtitle="Appearance, dates, and training"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <SectionCard
          eyebrow="Overview"
          title={user?.name || "Cultivator"}
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <SettingsSummaryTile
              label="Theme"
              value={selectedTheme?.label ?? themeStyle}
            />
            <SettingsSummaryTile
              label="Date format"
              value={selectedDateFormat?.label ?? settings.dateFormat}
              hint={selectedDateFormat?.sample}
            />
            <SettingsSummaryTile
              label="Timezone"
              value={selectedTimeZone?.label ?? settings.timeZone}
            />
            <SettingsSummaryTile
              label="Weight unit"
              value={settings.defaultWeightUnit.toUpperCase()}
            />
          </div>
        </SectionCard>

        <SettingsNavRow
          href="/dashboard/settings/appearance"
          eyebrow="Appearance"
          title="Theme"
          value={selectedTheme?.label ?? themeStyle}
          hint={modeLabel}
        />

        <SettingsNavRow
          href="/dashboard/settings/calendar"
          eyebrow="Calendar"
          title="Date and region"
          value={selectedTimeZone?.label ?? settings.timeZone}
          hint={`${selectedDateFormat?.label ?? settings.dateFormat} • ${selectedWeekStart?.label ?? settings.calendarWeekStart}`}
        />

        <SettingsNavRow
          href="/dashboard/settings/training"
          eyebrow="Training"
          title="Weight unit"
          value={settings.defaultWeightUnit.toUpperCase()}
        />

        <SectionCard
          eyebrow="Account"
          title={user?.username ? `@${user.username}` : "Account"}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>Signed in as {user?.name ?? "Cultivator"}</p>
            <GlowButton variant="crimson" onClick={logout}>
              Logout
            </GlowButton>
          </div>
        </SectionCard>
      </div>
    </PageLayout>
  );
}

