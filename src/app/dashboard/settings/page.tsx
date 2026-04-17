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
  { value: "discord", label: "Discord Default", desc: "Original Discord-style canvas" },
  { value: "midnight-ink", label: "Midnight Ink", desc: "Discord canvas with deep void + jade accents" },
  { value: "mountain-mist", label: "Mountain Mist", desc: "Discord canvas with misty parchment blues" },
  { value: "calligraphy", label: "Calligraphy", desc: "Discord canvas with monochrome ink tones" },
  { value: "sakura", label: "Sakura", desc: "Discord canvas with light blossom colors" },
  { value: "sakura-dark", label: "Sakura Dark", desc: "Discord canvas with dusk rose tones" },
  { value: "eternal", label: "Eternal", desc: "Discord canvas with clean minimal greens" },
  { value: "document", label: "Document", desc: "Discord canvas with paper and slate tones" },
  { value: "nyaa", label: "Nyaa", desc: "Discord canvas with blue-green contrast" },
  { value: "emerald-lotus", label: "Emerald Lotus", desc: "Discord canvas with jade temple colors" },
  { value: "gilded-bamboo", label: "Gilded Bamboo", desc: "Discord canvas with warm gold accents" },
  { value: "crane-peak", label: "Crane Peak", desc: "Discord canvas with silver-blue highlights" },
  { value: "obsidian-void", label: "Obsidian Void", desc: "Discord canvas with cosmic purple hues" },
  { value: "crimson-gate", label: "Crimson Gate", desc: "Discord canvas with ember-red contrast" },
  { value: "frost-sanctuary", label: "Frost Sanctuary", desc: "Discord canvas with icy aurora tones" },
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
      className="w-full min-w-0 overflow-hidden rounded-xl border p-3 text-left transition-colors duration-150"
      style={{
        borderColor: active ? "rgba(88, 101, 242, 0.6)" : "#3b3f48",
        backgroundColor: active ? "#383a40" : "#313338",
        boxShadow: "none",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold break-words" style={{ color: "#f2f3f5" }}>
            <LearningText text={title} languageMode={languageMode} enabled={learningEnabled} />
          </p>
          {subtitle ? (
            <p className="mt-1 text-[11px] break-words" style={{ color: "#b5bac1" }}>
              <LearningText text={subtitle} languageMode={languageMode} enabled={learningEnabled} />
            </p>
          ) : null}
        </div>
        {badge ? (
          <span
            className="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{
              borderColor: "rgba(88, 101, 242, 0.45)",
              backgroundColor: "rgba(88, 101, 242, 0.12)",
              color: "#c8cdfa",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function SettingsSelectField({
  label,
  helper,
  value,
  onChange,
  options,
}: {
  label: string;
  helper?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; desc?: string }>;
}) {
  const selected = options.find((option) => option.value === value);

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "#3b3f48",
        backgroundColor: "#313338",
        boxShadow: "none",
      }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">{label}</p>
      {helper ? <p className="mt-1 text-[11px]" style={{ color: "#b5bac1" }}>{helper}</p> : null}
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
      {selected?.desc ? (
        <p className="mt-2 text-[11px]" style={{ color: "#b5bac1" }}>{selected.desc}</p>
      ) : null}
    </div>
  );
}

function SettingsSection({
  id,
  eyebrow,
  title,
  description,
  children,
  active,
  onToggle,
}: {
  id: SectionId;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-xl border p-3 sm:p-4"
      style={{
        borderColor: active ? "rgba(88, 101, 242, 0.55)" : "#3b3f48",
        backgroundColor: "#2b2d31",
        boxShadow: "none",
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 text-left"
        aria-expanded={active}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "#949ba4" }}>{eyebrow}</p>
          <h2 className="mt-1 text-sm font-semibold uppercase tracking-[0.08em] sm:text-base" style={{ color: "#f2f3f5" }}>{title}</h2>
          <p className="mt-1 text-[11px]" style={{ color: "#b5bac1" }}>{description}</p>
        </div>
        <span
          className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-sm"
          style={{
            borderColor: active ? "rgba(88, 101, 242, 0.55)" : "#3b3f48",
            backgroundColor: active ? "#383a40" : "#313338",
            color: active ? "#f2f3f5" : "#b5bac1",
          }}
        >
          {active ? "−" : "+"}
        </span>
      </button>

      {active ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle, isMobile } = useAppContext();
  const { settings, updateSettings, resetSettings } = useDisplaySettings();
  const [activeSection, setActiveSection] = useState<SectionId | null>("overview");
  const [exerciseLanguageAutoSelectedNotice, setExerciseLanguageAutoSelectedNotice] = useState("");

  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.value === themeStyle)?.label ?? themeStyle,
    [themeStyle],
  );

  const timeZoneLabel = useMemo(
    () => TIMEZONE_OPTIONS.find((option) => option.value === settings.timeZone)?.label ?? settings.timeZone,
    [settings.timeZone],
  );

  const themeDescription = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.value === themeStyle)?.desc ?? "",
    [themeStyle],
  );

  const timeZoneDescription = useMemo(
    () => TIMEZONE_OPTIONS.find((option) => option.value === settings.timeZone)?.desc ?? "",
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
    const nextSection = activeSection === sectionId ? null : sectionId;
    setActiveSection(nextSection);
    if (!nextSection || typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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
        className="relative overflow-visible rounded-xl border p-2 sm:overflow-hidden sm:p-3"
        style={{
          borderColor: "#3b3f48",
          backgroundColor: "#2b2d31",
          boxShadow: "none",
        }}
      >
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px" style={{ background: "color-mix(in srgb, var(--accent) 28%, transparent)" }} />

        <div className={`relative min-w-0 gap-3 ${isMobile ? "space-y-3" : "grid xl:grid-cols-[260px_minmax(0,1fr)]"}`}>
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <div
              className="rounded-xl border p-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 2%, transparent)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">User settings</p>
              <h2 className="mt-2 text-lg font-semibold text-[#f2f3f5]">{user?.name || "Cultivator"}</h2>
              <p className="mt-1 text-[11px] text-[#b5bac1]">A Discord-style settings hub that adapts cleanly from phone to desktop.</p>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:flex xl:flex-col">
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
                      "w-full min-w-0 rounded-md border px-3 py-2 text-left text-sm transition-colors xl:w-full",
                      activeSection === section.id
                        ? "text-[#f2f3f5]"
                        : "text-[#b5bac1] hover:text-[#f2f3f5]",
                    ].join(" ")}
                    style={{
                      borderColor: activeSection === section.id ? "rgba(88, 101, 242, 0.6)" : "#3b3f48",
                      backgroundColor: activeSection === section.id ? "#383a40" : "#313338",
                    }}
                  >
                    {section.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <div
                  className="min-w-0 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "#3b3f48",
                    background: "#313338",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Theme</p>
                  <p className="mt-1 break-words text-sm font-medium" style={{ color: "#f2f3f5" }}>{themeLabel}</p>
                </div>
                <div
                  className="min-w-0 rounded-lg border px-3 py-2"
                  style={{
                    borderColor: "#3b3f48",
                    background: "#313338",
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">Zone</p>
                  <p className="mt-1 break-words text-sm font-medium" style={{ color: "#f2f3f5" }}>{timeZoneLabel}</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-2 sm:space-y-3">
            <SettingsSection
              id="overview"
              eyebrow="Control center"
              title="Clean settings canvas"
              description="The old dense table layout has been replaced with a simpler panel system designed for thumb-friendly mobile interaction and a spacious desktop view."
              active={activeSection === "overview"}
              onToggle={() => scrollToSection("overview")}
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
                    style={{ borderColor: "#3b3f48", background: "#313338" }}
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#949ba4]">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "#f2f3f5" }}>{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <GlowButton variant="ghost" onClick={resetSettings} className="w-full sm:w-auto">
                  <LearningText text="Reset Display Settings" languageMode={languageMode} enabled={learningEnabled} />
                </GlowButton>
                <GlowButton variant="crimson" onClick={logout} className="w-full sm:w-auto">
                  <LearningText text="Logout" languageMode={languageMode} enabled={learningEnabled} />
                </GlowButton>
              </div>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              eyebrow="Appearance"
              title="Canvas themes and date styling"
              description="Each theme now keeps the same Discord-inspired layout and sidebar sync while only changing the palette."
              active={activeSection === "appearance"}
              onToggle={() => scrollToSection("appearance")}
            >
              {isMobile ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  <SettingsSelectField
                    label="Theme"
                    helper="Use the selector for the longer theme list."
                    value={themeStyle}
                    onChange={(value) => setThemeStyle(value as Theme)}
                    options={THEME_OPTIONS.map((theme) => ({ value: theme.value, label: theme.label, desc: theme.desc }))}
                  />
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, var(--ink-deep))",
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Current theme</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "#f2f3f5" }}>{themeLabel}</p>
                    <p className="mt-1 text-[11px]" style={{ color: "#b5bac1" }}>{themeDescription}</p>
                  </div>
                </div>
              ) : (
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
              )}

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
              active={activeSection === "calendar"}
              onToggle={() => scrollToSection("calendar")}
            >
              {isMobile ? (
                <div className="grid gap-2 lg:grid-cols-2">
                  <SettingsSelectField
                    label="Timezone"
                    helper="Longer region lists now use a compact selector."
                    value={settings.timeZone}
                    onChange={(value) => updateSettings({ timeZone: value })}
                    options={TIMEZONE_OPTIONS.map((option) => ({ value: option.value, label: option.label, desc: option.desc }))}
                  />
                  <div
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, var(--ink-deep))",
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Selected region</p>
                    <p className="mt-1 text-sm font-semibold" style={{ color: "#f2f3f5" }}>{timeZoneLabel}</p>
                    <p className="mt-1 text-[11px]" style={{ color: "#b5bac1" }}>{timeZoneDescription}</p>
                  </div>
                </div>
              ) : (
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
              )}

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
              active={activeSection === "language"}
              onToggle={() => scrollToSection("language")}
            >
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">App language</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Label style</p>
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
              active={activeSection === "training"}
              onToggle={() => scrollToSection("training")}
            >
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Weight unit</p>
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#949ba4]">Variation labels</p>
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
