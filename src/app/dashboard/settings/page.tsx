"use client";

import { useMemo, useState, type ReactNode } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  type CalendarWeekStartOption,
  type DateFormatOption,
  type VariationDisplayMode,
  type WeightUnitPref,
} from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";
import type { LanguageMode } from "@/lib/language";
import LearningText from "@/components/ui/LearningText";

const THEME_OPTIONS: Array<{ value: Theme; label: string; desc: string }> = [
  { value: "midnight-ink", label: "Midnight Ink", desc: "Deep void + jade accents" },
  { value: "mountain-mist", label: "Mountain Mist", desc: "Ink wash + mist" },
  { value: "calligraphy", label: "Calligraphy", desc: "Monochrome scroll style" },
  { value: "sakura", label: "Sakura", desc: "Light blossom palette" },
  { value: "sakura-dark", label: "Sakura Dark", desc: "Deep rose dusk" },
  { value: "eternal", label: "Eternal", desc: "Clean minimalist" },
  { value: "discord", label: "Discord", desc: "Discord-inspired dark" },
  { value: "document", label: "Document", desc: "Paper + slate" },
  { value: "nyaa", label: "Nyaa", desc: "Nyaa blue-green" },
  { value: "emerald-lotus", label: "Emerald Lotus", desc: "Jade temple at dawn" },
  { value: "gilded-bamboo", label: "Gilded Bamboo", desc: "Golden scripture hall" },
  { value: "crane-peak", label: "Crane Peak", desc: "Celestial silver-blue" },
  { value: "obsidian-void", label: "Obsidian Void", desc: "Cosmic purple void" },
  { value: "crimson-gate", label: "Crimson Gate", desc: "Demonic crimson ember" },
  { value: "frost-sanctuary", label: "Frost Sanctuary", desc: "Glacial ice aurora" },
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

const SECTION_IDS = ["overview", "appearance", "calendar", "language", "training"] as const;
type SectionId = (typeof SECTION_IDS)[number];

function SettingsChoice({
  active,
  title,
  subtitle,
  badge,
  onClick,
  languageMode,
  learningEnabled,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  badge?: string;
  onClick: () => void;
  languageMode: LanguageMode;
  learningEnabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border p-3 text-left transition-colors duration-150"
      style={{
        borderColor: active
          ? "color-mix(in srgb, var(--accent) 55%, var(--border))"
          : "color-mix(in srgb, var(--border) 88%, transparent)",
        background: active
          ? "linear-gradient(135deg, color-mix(in srgb, var(--accent) 16%, var(--surface)), color-mix(in srgb, var(--surface-hover) 90%, var(--surface)))"
          : "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface-hover) 86%, transparent))",
        boxShadow: active ? "0 0 0 1px color-mix(in srgb, var(--accent) 16%, transparent)" : "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <LearningText text={title} languageMode={languageMode} enabled={learningEnabled} />
          </p>
          {subtitle ? (
            <p className="mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
              <LearningText text={subtitle} languageMode={languageMode} enabled={learningEnabled} />
            </p>
          ) : null}
        </div>
        {badge ? (
          <span
            className="rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              borderColor: "color-mix(in srgb, var(--accent) 42%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)",
              color: "var(--text-primary)",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SettingsSection({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  id: SectionId;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border p-3 sm:p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--border) 92%, var(--accent) 8%)",
        background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 96%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
        boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
      }}
    >
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold sm:text-xl" style={{ color: "var(--text-primary)" }}>{title}</h2>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle } = useAppContext();
  const { settings, updateSettings, resetSettings } = useDisplaySettings();
  const [activeSection, setActiveSection] = useState<SectionId>("overview");
  const [exerciseLanguageAutoSelectedNotice, setExerciseLanguageAutoSelectedNotice] = useState("");

  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.value === themeStyle)?.label ?? themeStyle,
    [themeStyle],
  );

  const timeZoneLabel = useMemo(
    () => TIMEZONE_OPTIONS.find((option) => option.value === settings.timeZone)?.label ?? settings.timeZone,
    [settings.timeZone],
  );

  const handleLanguageModeChange = (nextLanguageMode: LanguageMode) => {
    if (nextLanguageMode === "vietnamese") {
      const shouldAutoEnableExerciseLanguage = !settings.showExerciseForeignLanguage;
      updateSettings({
        languageMode: "vietnamese",
        showExerciseForeignLanguage: true,
      });
      setExerciseLanguageAutoSelectedNotice(
        shouldAutoEnableExerciseLanguage
          ? "Exercise language was auto-selected for Vietnamese UI."
          : "Exercise language remains enabled for Vietnamese UI.",
      );
      return;
    }

    updateSettings({ languageMode: nextLanguageMode });
    setExerciseLanguageAutoSelectedNotice("");
  };

  const scrollToSection = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    if (typeof document === "undefined") return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const languageMode = settings.languageMode ?? "english";
  const learningEnabled = settings.terminologyMode === "normal";

  return (
    <PageLayout
      title={learningEnabled ? (languageMode === "vietnamese" ? "Cài đặt" : "Settings") : "Settings"}
      subtitle={learningEnabled ? (languageMode === "vietnamese" ? "Tune the interface for mobile and desktop flow" : "Tune the interface for mobile and desktop flow") : "Tune the interface for mobile and desktop flow"}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div
        className="relative overflow-hidden rounded-xl border p-2 sm:p-3"
        style={{
          borderColor: "color-mix(in srgb, var(--border) 92%, var(--accent) 8%)",
          background: "linear-gradient(145deg, color-mix(in srgb, var(--background) 72%, var(--surface)), color-mix(in srgb, var(--surface) 94%, transparent))",
          boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
        }}
      >
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px" style={{ background: "color-mix(in srgb, var(--accent) 28%, transparent)" }} />

        <div className="relative grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: "color-mix(in srgb, var(--border) 92%, var(--accent) 8%)",
                background: "linear-gradient(180deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--ink-mid) 84%, var(--surface)))",
                boxShadow: "0 8px 18px rgba(0,0,0,0.18)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>User settings</p>
              <h2 className="mt-2 text-xl font-semibold" style={{ color: "var(--text-primary)" }}>{user?.name || "Cultivator"}</h2>
              <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>A Discord-style settings hub that adapts cleanly from phone to desktop.</p>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">
                {[
                  { id: "overview" as SectionId, label: "Overview" },
                  { id: "appearance" as SectionId, label: "Appearance" },
                  { id: "calendar" as SectionId, label: "Region" },
                  { id: "language" as SectionId, label: "Language" },
                  { id: "training" as SectionId, label: "Training" },
                ].map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => scrollToSection(section.id)}
                    className={[
                      "min-w-fit rounded-md border px-3 py-2 text-left text-sm transition-colors xl:w-full",
                      activeSection === section.id
                        ? "text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
                    ].join(" ")}
                    style={{
                      borderColor: activeSection === section.id
                        ? "color-mix(in srgb, var(--accent) 50%, transparent)"
                        : "color-mix(in srgb, var(--border) 90%, transparent)",
                      backgroundColor: activeSection === section.id
                        ? "color-mix(in srgb, var(--accent) 18%, var(--surface))"
                        : "color-mix(in srgb, var(--surface) 90%, transparent)",
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-1">
                <div
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border) 88%, transparent)",
                    background: "color-mix(in srgb, var(--surface) 94%, transparent)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-mist-dark">Theme</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{themeLabel}</p>
                </div>
                <div
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "color-mix(in srgb, var(--border) 88%, transparent)",
                    background: "color-mix(in srgb, var(--surface) 94%, transparent)",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.2em] text-mist-dark">Zone</p>
                  <p className="mt-1 text-sm font-medium" style={{ color: "var(--text-primary)" }}>{timeZoneLabel}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="space-y-3">
            <SettingsSection
              id="overview"
              eyebrow="Control center"
              title="Clean settings canvas"
              description="The old dense table layout has been replaced with a simpler panel system designed for thumb-friendly mobile interaction and a spacious desktop view."
            >
              <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4">
                {[
                  { label: "Current theme", value: themeLabel },
                  { label: "Date format", value: settings.dateFormat },
                  { label: "Week start", value: settings.calendarWeekStart },
                  { label: "Weight unit", value: settings.defaultWeightUnit.toUpperCase() },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border px-3 py-3"
                    style={{ borderColor: "color-mix(in srgb, var(--border) 88%, transparent)", background: "color-mix(in srgb, var(--surface) 94%, transparent)" }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.2em] text-mist-dark">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <GlowButton variant="ghost" onClick={resetSettings}>
                  <LearningText text="Reset Display Settings" languageMode={languageMode} enabled={learningEnabled} />
                </GlowButton>
                <GlowButton variant="crimson" onClick={logout}>
                  <LearningText text="Logout" languageMode={languageMode} enabled={learningEnabled} />
                </GlowButton>
              </div>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              eyebrow="Appearance"
              title="Theme and date styling"
              description="Optimized as stacked touch cards on mobile and a wider selection grid on desktop."
            >
              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {THEME_OPTIONS.map((theme) => (
                  <SettingsChoice
                    key={theme.value}
                    active={themeStyle === theme.value}
                    title={theme.label}
                    subtitle={theme.desc}
                    badge={theme.value === "discord" ? "discord" : undefined}
                    onClick={() => setThemeStyle(theme.value)}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {DATE_OPTIONS.map((option) => (
                  <SettingsChoice
                    key={option.value}
                    active={settings.dateFormat === option.value}
                    title={option.label}
                    subtitle={option.sample}
                    onClick={() => updateSettings({ dateFormat: option.value })}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="calendar"
              eyebrow="Region & calendar"
              title="Timezone-aware scheduling"
              description="Your calendar, logs, and today markers follow the user-selected region instead of a generic clock."
            >
              <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
                {TIMEZONE_OPTIONS.map((option) => (
                  <SettingsChoice
                    key={option.value}
                    active={settings.timeZone === option.value}
                    title={option.label}
                    subtitle={option.desc}
                    onClick={() => updateSettings({ timeZone: option.value })}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {CALENDAR_START_OPTIONS.map((option) => (
                  <SettingsChoice
                    key={option.value}
                    active={settings.calendarWeekStart === option.value}
                    title={option.label}
                    subtitle={option.desc}
                    onClick={() => updateSettings({ calendarWeekStart: option.value })}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              id="language"
              eyebrow="Language"
              title="Terminology and naming"
              description="Separate the overall app language from exercise-name display so mobile users can keep the UI clean."
            >
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-dark">App language</p>
                  <SettingsChoice
                    active={languageMode === "english"}
                    title="English"
                    subtitle="UI labels in English"
                    onClick={() => handleLanguageModeChange("english")}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                  <SettingsChoice
                    active={languageMode === "vietnamese"}
                    title="Vietnamese"
                    subtitle="UI labels in Vietnamese"
                    onClick={() => handleLanguageModeChange("vietnamese")}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-dark">Label style</p>
                  <SettingsChoice
                    active={settings.terminologyMode === "normal"}
                    title="Conventional"
                    subtitle="Standard fitness labels"
                    onClick={() => updateSettings({ terminologyMode: "normal" })}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                  <SettingsChoice
                    active={settings.terminologyMode === "fantasy"}
                    title="Cultivation"
                    subtitle="Wuxia-themed labels"
                    onClick={() => updateSettings({ terminologyMode: "fantasy" })}
                    languageMode={languageMode}
                    learningEnabled={learningEnabled}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <SettingsChoice
                  active={settings.showExerciseForeignLanguage}
                  title="Show exercises in foreign name"
                  subtitle="Helpful for bilingual learning"
                  onClick={() => updateSettings({ showExerciseForeignLanguage: true })}
                  languageMode={languageMode}
                  learningEnabled={learningEnabled}
                />
                <SettingsChoice
                  active={!settings.showExerciseForeignLanguage}
                  title="Hide exercises in foreign name"
                  subtitle="Cleaner, more compact list view"
                  onClick={() => updateSettings({ showExerciseForeignLanguage: false })}
                  languageMode={languageMode}
                  learningEnabled={learningEnabled}
                />
              </div>

              {exerciseLanguageAutoSelectedNotice ? (
                <p className="mt-3 rounded-xl border border-[rgba(88,101,242,0.22)] bg-[rgba(88,101,242,0.1)] px-3 py-2 text-xs text-[#d7dcff]">
                  <LearningText text={exerciseLanguageAutoSelectedNotice} languageMode={languageMode} enabled={learningEnabled} />
                </p>
              ) : null}
            </SettingsSection>

            <SettingsSection
              id="training"
              eyebrow="Training display"
              title="Weight and variation formatting"
              description="These controls stay compact on phones but open into a tidy two-column arrangement on larger screens."
            >
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-dark">Weight unit</p>
                  {([
                    { value: "kg" as WeightUnitPref, title: "Kilograms (kg)" },
                    { value: "lbs" as WeightUnitPref, title: "Pounds (lbs)" },
                  ]).map((option) => (
                    <SettingsChoice
                      key={option.value}
                      active={settings.defaultWeightUnit === option.value}
                      title={option.title}
                      onClick={() => updateSettings({ defaultWeightUnit: option.value })}
                      languageMode={languageMode}
                      learningEnabled={learningEnabled}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-mist-dark">Variation labels</p>
                  {([
                    { value: "abbreviation" as VariationDisplayMode, title: "Abbreviated", subtitle: "Short labels" },
                    { value: "full" as VariationDisplayMode, title: "Full text", subtitle: "Expanded labels" },
                  ]).map((option) => (
                    <SettingsChoice
                      key={option.value}
                      active={settings.progressionVariationDisplay === option.value}
                      title={option.title}
                      subtitle={option.subtitle}
                      onClick={() => updateSettings({ progressionVariationDisplay: option.value })}
                      languageMode={languageMode}
                      learningEnabled={learningEnabled}
                    />
                  ))}
                </div>
              </div>
            </SettingsSection>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
