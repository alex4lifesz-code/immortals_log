"use client";

import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  type CalendarWeekStartOption,
  type CheckInCalendarScopeOption,
  type CheckInHistoryViewMode,
  type DateFormatOption,
  type WeightUnitPref,
  type TimedUnitPref,
} from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";
import { translateEnglishToLanguage, type LanguageMode } from "@/lib/language";
import {
  CALENDAR_START_OPTIONS,
  DATE_OPTIONS,
  SectionCard,
  SettingsSelectField,
  THEME_OPTIONS,
  TIMEZONE_OPTIONS,
  fieldShellStyle,
} from "./_shared";

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle, themeMode, setThemeMode } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const selectedTheme = THEME_OPTIONS.find((t) => t.value === themeStyle);

  return (
    <PageLayout
      title={lt("Settings")}
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="space-y-3 px-0 py-0 sm:space-y-4 sm:py-1">

        {/* ── Appearance ───────────────────────────────────── */}
        <SectionCard eyebrow={lt("Appearance")} title={lt("Theme")}>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <SettingsSelectField
              label={lt("Theme style")}
              value={themeStyle}
              onChange={(value) => setThemeStyle(value as Theme)}
              options={THEME_OPTIONS.map((t) => ({ value: t.value, label: t.label, desc: t.desc }))}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedTheme?.label ?? themeStyle}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-mid)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-light)" }} />
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border p-3" style={fieldShellStyle}>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme appearance">
              {(["light", "dark", "auto"] as const).map((mode) => {
                const active = themeMode === mode;
                const disabled = mode === "light" || mode === "auto";
                const label = mode === "light" ? lt("Light") : mode === "dark" ? lt("Dark") : lt("Auto");
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={disabled}
                    onClick={() => !disabled && setThemeMode(mode)}
                    className="rounded-lg border px-3 py-2 text-center transition"
                    style={{
                      borderColor: disabled ? "var(--border)" : active ? "var(--accent)" : "var(--border)",
                      backgroundColor: disabled ? "color-mix(in srgb, var(--surface) 60%, transparent)" : active ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)",
                      color: "var(--text-muted)",
                      boxShadow: active && !disabled ? "var(--glow-subtle)" : "none",
                      opacity: disabled ? 0.45 : 1,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    <div className="text-sm font-semibold" style={{ color: disabled ? "var(--text-muted)" : active ? "var(--text-primary)" : "var(--text-secondary)" }}>{label}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* ── Calendar ─────────────────────────────────────── */}
        <SectionCard eyebrow={lt("Calendar")} title={lt("Date and region")}>
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingsSelectField
              label={lt("Timezone")}
              value={settings.timeZone}
              onChange={(value) => updateSettings({ timeZone: value })}
              options={TIMEZONE_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
            />
            <SettingsSelectField
              label={lt("Date format")}
              value={settings.dateFormat}
              onChange={(value) => updateSettings({ dateFormat: value as DateFormatOption })}
              options={DATE_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.sample }))}
            />
            <SettingsSelectField
              label={lt("Week starts on")}
              value={settings.calendarWeekStart}
              onChange={(value) => updateSettings({ calendarWeekStart: value as CalendarWeekStartOption })}
              options={CALENDAR_START_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
            />
          </div>
        </SectionCard>

        {/* ── Language ─────────────────────────────────────── */}
        <SectionCard eyebrow={lt("Language")} title={lt("Interface language")}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <SettingsSelectField
              label={lt("App language")}
              value={settings.languageMode}
              onChange={(value) => updateSettings({ languageMode: value as LanguageMode })}
              options={[
                { value: "english", label: lt("English"), desc: lt("Use English across the interface") },
                { value: "vietnamese", label: "Tiếng Việt", desc: "Sử dụng tiếng Việt cho giao diện" },
              ]}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>{lt("Preview")}</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {settings.languageMode === "vietnamese" ? "Giao diện ứng dụng" : lt("Application interface")}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Training ─────────────────────────────────────── */}
        <SectionCard eyebrow={lt("Training")} title={lt("Units")}>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <SettingsSelectField
              label={lt("Preferred weight unit")}
              value={settings.defaultWeightUnit}
              onChange={(value) => updateSettings({ defaultWeightUnit: value as WeightUnitPref })}
              options={[
                { value: "kg", label: lt("Kilograms (kg)"), desc: lt("Best for metric-based training logs") },
                { value: "lbs", label: lt("Pounds (lbs)"), desc: lt("Best for imperial-based training logs") },
              ]}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lt("Bench Press")} • 20 {settings.defaultWeightUnit.toUpperCase()}</p>
            </div>
            <SettingsSelectField
              label={lt("Timed display unit")}
              value={settings.defaultTimedUnit}
              onChange={(value) => updateSettings({ defaultTimedUnit: value as TimedUnitPref })}
              options={[
                { value: "seconds", label: lt("Seconds (s)"), desc: lt("e.g. 90s — raw seconds") },
                { value: "minutes", label: lt("Minutes (m s)"), desc: lt("e.g. 1m 30s — easier to read") },
              ]}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {lt("Plank")} • {settings.defaultTimedUnit === "minutes" ? "1m 30s" : "90s"}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Check-In ─────────────────────────────────────── */}
        <SectionCard
          eyebrow={lt("Check-In")}
          title={lt("History defaults")}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <SettingsSelectField
              label={lt("Default history view")}
              value={settings.checkInHistoryView}
              onChange={(value) => updateSettings({ checkInHistoryView: value as CheckInHistoryViewMode })}
              options={[
                { value: "compact", label: lt("Compact"), desc: lt("Dense rows for quick scanning") },
                { value: "detailed", label: lt("Detailed"), desc: lt("Expanded row details") },
              ]}
            />
            <SettingsSelectField
              label={lt("Default scope")}
              value={settings.checkInCalendarScope}
              onChange={(value) => updateSettings({ checkInCalendarScope: value as CheckInCalendarScopeOption })}
              options={[
                { value: "all", label: lt("All"), desc: lt("Your entries and your friends") },
                { value: "mine", label: lt("Mine"), desc: lt("Only your personal entries") },
                { value: "friends", label: lt("Friends"), desc: lt("Only friends' entries") },
              ]}
            />
          </div>
        </SectionCard>

        {/* ── Account ──────────────────────────────────────── */}
        <SectionCard
          eyebrow={lt("Account")}
          title={user?.username ? `@${user.username}` : lt("Account")}
        >
          <div className="flex items-center justify-between gap-3">
            <GlowButton variant="crimson" onClick={logout}>
              {lt("Logout")}
            </GlowButton>
          </div>
        </SectionCard>

      </div>
    </PageLayout>
  );
}


