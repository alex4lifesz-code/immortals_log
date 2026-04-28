"use client";

import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  type CalendarWeekStartOption,
  type DateFormatOption,
  type WeightUnitPref,
  type TimedUnitPref,
} from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";
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
  const selectedTheme = THEME_OPTIONS.find((t) => t.value === themeStyle);

  return (
    <PageLayout
      title="Settings"
      subtitle="Appearance, dates, and training"
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="space-y-3 px-0 py-0 sm:space-y-4 sm:py-1">

        {/* ── Appearance ───────────────────────────────────── */}
        <SectionCard eyebrow="Appearance" title="Theme" description="Visual style applied across the entire app." badge="Visual">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <SettingsSelectField
              label="Theme style"
              value={themeStyle}
              onChange={(value) => setThemeStyle(value as Theme)}
              options={THEME_OPTIONS.map((t) => ({ value: t.value, label: t.label, desc: t.desc }))}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Current look</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{selectedTheme?.label ?? themeStyle}</p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>{selectedTheme?.desc ?? "Palette synced across the entire app shell."}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--accent)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-mid)" }} />
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--ink-light)" }} />
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border p-3" style={fieldShellStyle}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Appearance</p>
            <p className="mt-1 mb-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              Light variants are available for every theme except Discord. Auto follows your device&apos;s system color scheme.
            </p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme appearance">
              {(["light", "dark", "auto"] as const).map((mode) => {
                const active = themeMode === mode;
                const label = mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Auto";
                const hint = mode === "light" ? "Daytime" : mode === "dark" ? "Nighttime" : "Follow system";
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setThemeMode(mode)}
                    className="rounded-lg border px-3 py-2 text-center transition"
                    style={{
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      backgroundColor: active ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)",
                      color: active ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: active ? "var(--glow-subtle)" : "none",
                    }}
                  >
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-[10px] opacity-80">{hint}</div>
                  </button>
                );
              })}
            </div>
            {themeStyle === "discord" && (
              <p className="mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
                Note: Discord theme has no light variant — appearance applies the moment you switch to another theme.
              </p>
            )}
          </div>
        </SectionCard>

        {/* ── Calendar ─────────────────────────────────────── */}
        <SectionCard eyebrow="Calendar" title="Date and region" description="Keep history, schedules, and logs aligned everywhere." badge="Sync">
          <div className="grid gap-3 lg:grid-cols-3">
            <SettingsSelectField
              label="Timezone"
              value={settings.timeZone}
              onChange={(value) => updateSettings({ timeZone: value })}
              options={TIMEZONE_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
            />
            <SettingsSelectField
              label="Date format"
              value={settings.dateFormat}
              onChange={(value) => updateSettings({ dateFormat: value as DateFormatOption })}
              options={DATE_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.sample }))}
            />
            <SettingsSelectField
              label="Week starts on"
              value={settings.calendarWeekStart}
              onChange={(value) => updateSettings({ calendarWeekStart: value as CalendarWeekStartOption })}
              options={CALENDAR_START_OPTIONS.map((o) => ({ value: o.value, label: o.label, desc: o.desc }))}
            />
          </div>
        </SectionCard>

        {/* ── Training ─────────────────────────────────────── */}
        <SectionCard eyebrow="Training" title="Units" description="Set them once and keep every session log readable." badge="Log">
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
            </div>
            <SettingsSelectField
              label="Timed display unit"
              value={settings.defaultTimedUnit}
              onChange={(value) => updateSettings({ defaultTimedUnit: value as TimedUnitPref })}
              options={[
                { value: "seconds", label: "Seconds (s)", desc: "e.g. 90s — raw seconds" },
                { value: "minutes", label: "Minutes (m s)", desc: "e.g. 1m 30s — easier to read" },
              ]}
            />
            <div className="rounded-xl border p-3" style={fieldShellStyle}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-muted)" }}>Preview</p>
              <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                Plank • {settings.defaultTimedUnit === "minutes" ? "1m 30s" : "90s"}
              </p>
              <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                Timed entries in history and logs will be shown in this unit.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* ── Account ──────────────────────────────────────── */}
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


