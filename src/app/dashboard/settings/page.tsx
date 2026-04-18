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
import type { LanguageMode } from "@/lib/language";

const THEME_OPTIONS: Array<{ value: Theme; label: string; desc: string }> = [
  { value: "discord", label: "Discord Default", desc: "Original Discord-style canvas" },
  { value: "midnight-ink", label: "Midnight Ink", desc: "Deep void with jade accents" },
  { value: "mountain-mist", label: "Mountain Mist", desc: "Misty parchment blues" },
  { value: "calligraphy", label: "Calligraphy", desc: "Monochrome ink tones" },
  { value: "sakura", label: "Sakura", desc: "Light blossom colors" },
  { value: "sakura-dark", label: "Sakura Dark", desc: "Dusk rose tones" },
  { value: "eternal", label: "Eternal", desc: "Clean minimal greens" },
  { value: "document", label: "Document", desc: "Paper and slate tones" },
  { value: "nyaa", label: "Nyaa", desc: "Blue-green contrast" },
  { value: "emerald-lotus", label: "Emerald Lotus", desc: "Jade temple colors" },
  { value: "gilded-bamboo", label: "Gilded Bamboo", desc: "Warm gold accents" },
  { value: "crane-peak", label: "Crane Peak", desc: "Silver-blue highlights" },
  { value: "obsidian-void", label: "Obsidian Void", desc: "Cosmic purple hues" },
  { value: "crimson-gate", label: "Crimson Gate", desc: "Ember-red contrast" },
  { value: "frost-sanctuary", label: "Frost Sanctuary", desc: "Icy aurora tones" },
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

function SectionCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="rounded-xl border p-3 sm:p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid))",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 2%, transparent)",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">{eyebrow}</p>
      <h2 className="mt-1 text-[15px] font-semibold text-[#f2f3f5]">{title}</h2>
      {description ? <p className="mt-1 text-[11px] text-[#b5bac1]">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
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
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">{label}</p>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-lg border px-3 text-sm outline-none"
        style={{
          borderColor: "#3b3f48",
          backgroundColor: "#232428",
          color: "#f2f3f5",
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {selected?.desc ? <p className="mt-2 text-[11px] text-[#b5bac1]">{selected.desc}</p> : null}
    </div>
  );
}

function ToggleOption({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border p-3 text-left transition-colors"
      style={{
        borderColor: active ? "rgba(88, 101, 242, 0.56)" : "#3b3f48",
        backgroundColor: active ? "#383a40" : "#313338",
      }}
    >
      <p className="text-sm font-semibold text-[#f2f3f5]">{title}</p>
      {subtitle ? <p className="mt-1 text-[11px] text-[#b5bac1]">{subtitle}</p> : null}
    </button>
  );
}

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle } = useAppContext();
  const { settings, updateSettings, resetSettings } = useDisplaySettings();
  const languageMode = settings.languageMode ?? "english";

  const handleLanguageModeChange = (nextLanguageMode: LanguageMode) => {
    if (nextLanguageMode === "vietnamese") {
      updateSettings({
        languageMode: "vietnamese",
        showExerciseForeignLanguage: true,
      });
      return;
    }

    updateSettings({ languageMode: nextLanguageMode });
  };

  return (
    <PageLayout
      title={languageMode === "vietnamese" ? "Cài đặt" : "Settings"}
      subtitle="Core preferences only"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <SectionCard
          eyebrow="Settings"
          title={user?.name || "Cultivator"}
          description="Only the settings that still matter for everyday use."
        >
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "#3b3f48", background: "#313338" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Theme</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{THEME_OPTIONS.find((theme) => theme.value === themeStyle)?.label ?? themeStyle}</p>
            </div>
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "#3b3f48", background: "#313338" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Date</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{settings.dateFormat}</p>
            </div>
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "#3b3f48", background: "#313338" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Timezone</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{TIMEZONE_OPTIONS.find((zone) => zone.value === settings.timeZone)?.label ?? settings.timeZone}</p>
            </div>
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "#3b3f48", background: "#313338" }}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Weight</p>
              <p className="mt-1 text-sm font-semibold text-[#f2f3f5]">{settings.defaultWeightUnit.toUpperCase()}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Appearance" title="Theme" description="Pick the canvas look for the app.">
          <SettingsSelectField
            label="Theme style"
            value={themeStyle}
            onChange={(value) => setThemeStyle(value as Theme)}
            options={THEME_OPTIONS.map((theme) => ({ value: theme.value, label: theme.label, desc: theme.desc }))}
          />
        </SectionCard>

        <SectionCard eyebrow="Calendar" title="Date and region" description="Keep dates and schedules consistent across the app.">
          <div className="grid gap-3 lg:grid-cols-2">
            <SettingsSelectField
              label="Timezone"
              value={settings.timeZone}
              onChange={(value) => updateSettings({ timeZone: value })}
              options={TIMEZONE_OPTIONS.map((option) => ({ value: option.value, label: option.label, desc: option.desc }))}
            />

            <div className="grid gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Date format</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {DATE_OPTIONS.map((option) => (
                  <ToggleOption
                    key={option.value}
                    active={settings.dateFormat === option.value}
                    title={option.label}
                    subtitle={option.sample}
                    onClick={() => updateSettings({ dateFormat: option.value })}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Week starts on</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {CALENDAR_START_OPTIONS.map((option) => (
                <ToggleOption
                  key={option.value}
                  active={settings.calendarWeekStart === option.value}
                  title={option.label}
                  subtitle={option.desc}
                  onClick={() => updateSettings({ calendarWeekStart: option.value })}
                />
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Language" title="Language and names" description="Keep the UI readable while choosing how exercise names appear.">
          <div className="grid gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">App language</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleOption
                  active={languageMode === "english"}
                  title="English"
                  subtitle="UI labels in English"
                  onClick={() => handleLanguageModeChange("english")}
                />
                <ToggleOption
                  active={languageMode === "vietnamese"}
                  title="Vietnamese"
                  subtitle="UI labels in Vietnamese"
                  onClick={() => handleLanguageModeChange("vietnamese")}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Naming style</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <ToggleOption
                  active={settings.terminologyMode === "normal"}
                  title="Conventional"
                  subtitle="Standard fitness labels"
                  onClick={() => updateSettings({ terminologyMode: "normal" })}
                />
                <ToggleOption
                  active={settings.terminologyMode === "fantasy"}
                  title="Cultivation"
                  subtitle="Wuxia-style labels"
                  onClick={() => updateSettings({ terminologyMode: "fantasy" })}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Exercise names</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <ToggleOption
                active={settings.showExerciseForeignLanguage}
                title="Show bilingual names"
                subtitle="Helpful for learning and matching names"
                onClick={() => updateSettings({ showExerciseForeignLanguage: true })}
              />
              <ToggleOption
                active={!settings.showExerciseForeignLanguage}
                title="Show cleaner names"
                subtitle="More compact across lists and tables"
                onClick={() => updateSettings({ showExerciseForeignLanguage: false })}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard eyebrow="Training" title="Weight unit" description="Keep training logs consistent with your preferred unit.">
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              { value: "kg" as WeightUnitPref, title: "Kilograms (kg)" },
              { value: "lbs" as WeightUnitPref, title: "Pounds (lbs)" },
            ]).map((option) => (
              <ToggleOption
                key={option.value}
                active={settings.defaultWeightUnit === option.value}
                title={option.title}
                onClick={() => updateSettings({ defaultWeightUnit: option.value })}
              />
            ))}
          </div>
        </SectionCard>

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <GlowButton variant="ghost" onClick={resetSettings} className="w-full sm:w-auto">
            Reset Display Settings
          </GlowButton>
          <GlowButton variant="crimson" onClick={logout} className="w-full sm:w-auto">
            Logout
          </GlowButton>
        </div>
      </div>
    </PageLayout>
  );
}
