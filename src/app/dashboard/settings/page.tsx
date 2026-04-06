"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  DateFormatOption,
  VariationDisplayMode,
  WeightUnitPref,
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
];

const DATE_OPTIONS: Array<{ value: DateFormatOption; label: string; sample: string }> = [
  { value: "dd-mm-yyyy", label: "DD-MM-YYYY", sample: "24-02-2026" },
  { value: "dd-mmm-yyyy", label: "DD-MMM-YYYY", sample: "24-Feb-2026" },
  { value: "dd-mm-yy", label: "DD-MM-YY", sample: "24-02-26" },
  { value: "dd-mmm-yy", label: "DD-MMM-YY", sample: "24-Feb-26" },
];

type SettingsSectionKey =
  | "theme"
  | "dateFormat"
  | "terminology"
  | "language"
  | "exerciseLanguage"
  | "weightUnit"
  | "variationLabels";

const DEFAULT_SECTION_STATE: Record<SettingsSectionKey, boolean> = {
  theme: false,
  dateFormat: false,
  terminology: false,
  language: false,
  exerciseLanguage: false,
  weightUnit: false,
  variationLabels: false,
};

function OptionButton({
  active,
  title,
  subtitle,
  onClick,
  languageMode,
  learningEnabled,
}: {
  active: boolean;
  title: string;
  subtitle?: string;
  onClick: () => void;
  languageMode: LanguageMode;
  learningEnabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-lg border px-2.5 py-2 transition-colors"
      style={{
        borderColor: active ? "var(--jade-glow)" : "var(--border)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--jade-glow) 10%, var(--surface))"
          : "var(--surface)",
        color: active ? "var(--jade-glow)" : "var(--text-primary)",
      }}
    >
      <p className="text-[11px] font-semibold"><LearningText text={title} languageMode={languageMode} enabled={learningEnabled} /></p>
      {subtitle ? (
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          <LearningText text={subtitle} languageMode={languageMode} enabled={learningEnabled} />
        </p>
      ) : null}
    </button>
  );
}

function CollapsiblePanel({
  sectionKey,
  title,
  open,
  onToggle,
  languageMode,
  learningEnabled,
  children,
}: {
  sectionKey: SettingsSectionKey;
  title: string;
  open: boolean;
  onToggle: (sectionKey: SettingsSectionKey) => void;
  languageMode: LanguageMode;
  learningEnabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <GlowCard glow="jade" hoverable={false} className="overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(sectionKey)}
        className="w-full text-left"
        aria-expanded={open}
      >
        <div
          className="flex items-center justify-between"
        >
          <h3 className="text-sm text-jade-glow uppercase tracking-wider">
            <LearningText text={title} languageMode={languageMode} enabled={learningEnabled} />
          </h3>
          <span className="text-xs font-bold text-jade-glow">
            {open ? "-" : "+"}
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: "hidden" }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </GlowCard>
  );
}

export default function SettingsPage() {
  const { logout, user } = useAuth();
  const { themeStyle, setThemeStyle } = useAppContext();
  const { settings, updateSettings, resetSettings } = useDisplaySettings();

  const themeLabel = useMemo(
    () => THEME_OPTIONS.find((theme) => theme.value === themeStyle)?.label ?? themeStyle,
    [themeStyle],
  );
  const [openSections, setOpenSections] = useState(DEFAULT_SECTION_STATE);
  const [exerciseLanguageAutoSelectedNotice, setExerciseLanguageAutoSelectedNotice] = useState("");

  const toggleSection = (sectionKey: SettingsSectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleLanguageModeChange = (nextLanguageMode: LanguageMode) => {
    if (nextLanguageMode === "vietnamese") {
      const shouldAutoEnableExerciseLanguage = !settings.showExerciseForeignLanguage;

      updateSettings({
        languageMode: "vietnamese",
        showExerciseForeignLanguage: true,
      });

      setOpenSections((prev) => ({
        ...prev,
        exerciseLanguage: true,
      }));

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

  const languageMode = settings.languageMode ?? "english";
  const learningEnabled = settings.terminologyMode === "normal";

  return (
    <PageLayout
      title={learningEnabled ? (languageMode === "vietnamese" ? "Cài đặt" : "Settings") : "Settings"}
      subtitle={learningEnabled ? (languageMode === "vietnamese" ? "Tùy chỉnh giao diện tập luyện" : "Configure your training interface") : "Configure your training interface"}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-6 px-0 py-2 sm:py-3">
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">
              <LearningText text="Settings Summary" languageMode={languageMode} enabled={learningEnabled} />
            </h3>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "30%" }}>
                  <LearningText text="User:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {user?.name || "Unknown"}
                </td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "20%" }}>
                  <LearningText text="Theme:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                  {themeLabel}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Date Format:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {settings.dateFormat}
                </td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Terminology:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <LearningText text={settings.terminologyMode === "fantasy" ? "Cultivation" : "Conventional"} languageMode={languageMode} enabled={learningEnabled} />
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Weight Unit:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {settings.defaultWeightUnit}
                </td>
                <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Variation Labels:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                  {settings.progressionVariationDisplay}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-t border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Language:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-t" colSpan={3} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <LearningText text={languageMode === "vietnamese" ? "Vietnamese" : "English"} languageMode={languageMode} enabled={learningEnabled} />
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-t border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  <LearningText text="Exercise Name Language:" languageMode={languageMode} enabled={learningEnabled} />
                </td>
                <td className="px-2 py-1.5 border-t" colSpan={3} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  <LearningText text={settings.showExerciseForeignLanguage ? "Show exercises in foreign name" : "Hide exercises in foreign name"} languageMode={languageMode} enabled={learningEnabled} />
                </td>
              </tr>
            </tbody>
          </table>
        </GlowCard>

        <CollapsiblePanel
          sectionKey="theme"
          title="Theme"
          open={openSections.theme}
          onToggle={toggleSection}
          languageMode={languageMode}
          learningEnabled={learningEnabled}
        >
          <div className="grid gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3">
            {THEME_OPTIONS.map((theme) => (
              <OptionButton
                key={theme.value}
                active={themeStyle === theme.value}
                title={theme.label}
                subtitle={theme.desc}
                onClick={() => setThemeStyle(theme.value)}
                languageMode={languageMode}
                learningEnabled={learningEnabled}
              />
            ))}
          </div>
        </CollapsiblePanel>

        <div className="grid gap-2 lg:grid-cols-2">
          <CollapsiblePanel
            sectionKey="dateFormat"
            title="Date Format"
            open={openSections.dateFormat}
            onToggle={toggleSection}
            languageMode={languageMode}
            learningEnabled={learningEnabled}
          >
            <div className="grid gap-1.5 p-2">
              {DATE_OPTIONS.map((option) => (
                <OptionButton
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
          </CollapsiblePanel>

          <CollapsiblePanel
            sectionKey="terminology"
            title="Terminology"
            open={openSections.terminology}
            onToggle={toggleSection}
            languageMode={languageMode}
            learningEnabled={learningEnabled}
          >
            <div className="grid gap-1.5 p-2">
              <OptionButton
                active={settings.terminologyMode === "fantasy"}
                title="Cultivation"
                subtitle="Wuxia-themed labels"
                onClick={() => updateSettings({ terminologyMode: "fantasy" })}
                languageMode={languageMode}
                learningEnabled={learningEnabled}
              />
              <OptionButton
                active={settings.terminologyMode === "normal"}
                title="Conventional"
                subtitle="Standard fitness labels"
                onClick={() => updateSettings({ terminologyMode: "normal" })}
                languageMode={languageMode}
                learningEnabled={learningEnabled}
              />
            </div>
          </CollapsiblePanel>
        </div>

        <CollapsiblePanel
          sectionKey="language"
          title="Language"
          open={openSections.language}
          onToggle={toggleSection}
          languageMode={languageMode}
          learningEnabled={learningEnabled}
        >
          <div className="grid gap-1.5 p-2">
            <OptionButton
              active={languageMode === "english"}
              title="English"
              subtitle="UI in English"
              onClick={() => handleLanguageModeChange("english")}
              languageMode={languageMode}
              learningEnabled={learningEnabled}
            />
            <OptionButton
              active={languageMode === "vietnamese"}
              title="Vietnamese"
              subtitle="UI in Vietnamese"
              onClick={() => handleLanguageModeChange("vietnamese")}
              languageMode={languageMode}
              learningEnabled={learningEnabled}
            />
          </div>
        </CollapsiblePanel>

        <CollapsiblePanel
          sectionKey="exerciseLanguage"
          title="Exercise Language"
          open={openSections.exerciseLanguage}
          onToggle={toggleSection}
          languageMode={languageMode}
          learningEnabled={learningEnabled}
        >
          <div className="grid gap-1.5 p-2">
            <OptionButton
              active={settings.showExerciseForeignLanguage}
              title="Show exercises in foreign name"
              subtitle="Show foreign-language exercise names"
              onClick={() => updateSettings({ showExerciseForeignLanguage: true })}
              languageMode={languageMode}
              learningEnabled={learningEnabled}
            />
            <OptionButton
              active={!settings.showExerciseForeignLanguage}
              title="Hide exercises in foreign name"
              subtitle="Hide foreign-language exercise names"
              onClick={() => updateSettings({ showExerciseForeignLanguage: false })}
              languageMode={languageMode}
              learningEnabled={learningEnabled}
            />
          </div>
          {exerciseLanguageAutoSelectedNotice ? (
            <p
              className="px-2 pb-2 text-[11px]"
              style={{ color: "var(--accent)" }}
            >
              <LearningText text={exerciseLanguageAutoSelectedNotice} languageMode={languageMode} enabled={learningEnabled} />
            </p>
          ) : null}
        </CollapsiblePanel>

        <div className="grid gap-2 lg:grid-cols-2">
          <CollapsiblePanel
            sectionKey="weightUnit"
            title="Weight Unit"
            open={openSections.weightUnit}
            onToggle={toggleSection}
            languageMode={languageMode}
            learningEnabled={learningEnabled}
          >
            <div className="grid gap-1.5 p-2">
              {([
                { value: "kg" as WeightUnitPref, title: "Kilograms (kg)" },
                { value: "lbs" as WeightUnitPref, title: "Pounds (lbs)" },
              ]).map((option) => (
                <OptionButton
                  key={option.value}
                  active={settings.defaultWeightUnit === option.value}
                  title={option.title}
                  onClick={() => updateSettings({ defaultWeightUnit: option.value })}
                  languageMode={languageMode}
                  learningEnabled={learningEnabled}
                />
              ))}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            sectionKey="variationLabels"
            title="Variation Labels"
            open={openSections.variationLabels}
            onToggle={toggleSection}
            languageMode={languageMode}
            learningEnabled={learningEnabled}
          >
            <div className="grid gap-1.5 p-2">
              {([
                { value: "abbreviation" as VariationDisplayMode, title: "Abbreviated", subtitle: "Short labels" },
                { value: "full" as VariationDisplayMode, title: "Full Text", subtitle: "Expanded labels" },
              ]).map((option) => (
                <OptionButton
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
          </CollapsiblePanel>
        </div>

        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">
            <LearningText text="Actions" languageMode={languageMode} enabled={learningEnabled} />
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <GlowButton variant="ghost" onClick={resetSettings} className="w-full">
              <LearningText text="Reset Display Settings" languageMode={languageMode} enabled={learningEnabled} />
            </GlowButton>
            <GlowButton variant="crimson" onClick={logout} className="w-full">
              <LearningText text="Logout" languageMode={languageMode} enabled={learningEnabled} />
            </GlowButton>
          </div>
        </GlowCard>
      </div>
    </PageLayout>
  );
}
