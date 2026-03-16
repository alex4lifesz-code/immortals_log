"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings, ActiveCardStyle, DateFormatOption, PRESET_SLOT_COUNT } from "@/context/DisplaySettingsContext";
import { getDifficultyGlowStyleScaled, getDifficultyColorClass } from "@/lib/difficulty-styles";

import { t } from "@/lib/terminology";

const PREVIEW_EXERCISES = [
  { name: "Iron Palm Strike", difficulty: "Mortal", type: "Upper Heaven", emoji: "☁️", realm: "Mortal", path: "Upper Heaven" },
  { name: "Dragon Stance", difficulty: "Foundation Establishment", type: "Lower Realms", emoji: "🔥", realm: "Foundation", path: "Lower Realms" },
  { name: "Cloud Step", difficulty: "Core Formation", type: "Heart Meridian", emoji: "💚", realm: "Core", path: "Heart Meridian" },
  { name: "Heavenly Press", difficulty: "Nascent Soul", type: "Upper Heaven", emoji: "☁️", realm: "Nascent Soul", path: "Upper Heaven" },
  { name: "Phoenix Curl", difficulty: "Soul Splitting", type: "Lower Realms", emoji: "🔥", realm: "Soul", path: "Lower Realms" },
  { name: "Void Meditation", difficulty: "Tribulation Transcendence", type: "Heart Meridian", emoji: "💚", realm: "Tribulation", path: "Heart Meridian" },
  { name: "Immortal Row", difficulty: "Immortal", type: "Upper Heaven", emoji: "⭐", realm: "Immortal", path: "Upper Heaven" },
];

// Sample table data for glow preview
const PREVIEW_TABLE_ROWS = [
  { name: "Iron Palm Strike", difficulty: "Mortal", w: [40, 45, 40], r: [12, 10, 12] },
  { name: "Cloud Step", difficulty: "Core Formation", w: [60, 65, 60], r: [10, 8, 10] },
  { name: "Void Meditation", difficulty: "Tribulation Transcendence", w: [100, 105, 100], r: [6, 5, 6] },
];

// Cultivation colour ticks for check-in preview
const CULTIVATION_COLOURS = [
  { level: "Mortal", color: "#22c55e", label: "Mortal" },
  { level: "Foundation Establishment", color: "#f59e0b", label: "Foundation" },
  { level: "Core Formation", color: "#ef4444", label: "Core Formation" },
  { level: "Nascent Soul", color: "#8b5cf6", label: "Nascent Soul" },
  { level: "Soul Splitting", color: "#ec4899", label: "Soul Splitting" },
  { level: "Tribulation Transcendence", color: "#c4a84a", label: "Tribulation" },
  { level: "Immortal", color: "#f9a8d4", label: "Immortal" },
];

// Terminology comparison pairs for the terminology config page
const TERMINOLOGY_COMPARISONS = [
  { fantasy: "Dao Hall", normal: "Dashboard" },
  { fantasy: "Training Grounds", normal: "Workout" },
  { fantasy: "Technique Scroll", normal: "Exercise Library" },
  { fantasy: "Sect Register", normal: "Check-In Log" },
  { fantasy: "Cultivation Path", normal: "Progress" },
  { fantasy: "Inner Chamber", normal: "Settings" },
  { fantasy: "Cultivator", normal: "Member" },
  { fantasy: "Techniques", normal: "Exercises" },
];

export const SETUP_WIZARD_COMPLETED_KEY = "cultivation-setup-wizard-completed";

interface SetupWizardProps {
  onComplete: () => void;
}

const TOTAL_PAGES = 8;

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const [page, setPage] = useState(0);
  const { themeStyle, setThemeStyle } = useAppContext();
  const { settings, updateSettings, presets, savePreset } = useDisplaySettings();
  const [previewIdx, setPreviewIdx] = useState(() => Math.floor(Math.random() * PREVIEW_EXERCISES.length));
  const [selectedPresetSlot, setSelectedPresetSlot] = useState<number | null>(null);

  const cyclePreview = useCallback(() => {
    setPreviewIdx((i) => (i + 1) % PREVIEW_EXERCISES.length);
  }, []);

  useEffect(() => {
    if (page !== 1) return;
    const id = setInterval(cyclePreview, 2200);
    return () => clearInterval(id);
  }, [page, cyclePreview]);

  const preview = PREVIEW_EXERCISES[previewIdx];

  const handleComplete = () => {
    // Save to selected preset slot if chosen
    if (selectedPresetSlot !== null) {
      savePreset(selectedPresetSlot, `Setup Wizard`);
    }
    localStorage.setItem(SETUP_WIZARD_COMPLETED_KEY, "true");
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(SETUP_WIZARD_COMPLETED_KEY, "true");
    onComplete();
  };

  const next = () => setPage((p) => Math.min(p + 1, TOTAL_PAGES - 1));
  const prev = () => setPage((p) => Math.max(p - 1, 0));

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-void-black/95 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg mx-4 bg-ink-deep border border-jade-deep/40 rounded-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1 bg-ink-dark">
          <motion.div
            className="h-full bg-gradient-to-r from-jade-glow to-jade-light"
            animate={{ width: `${((page + 1) / TOTAL_PAGES) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Content area */}
        <div className="p-6 min-h-[420px] flex flex-col">
          <AnimatePresence mode="wait">
            {page === 0 && (
              <WizardPage key="welcome" title="Welcome, Cultivator" subtitle="Let us prepare your cultivation environment">
                <p className="text-xs text-mist-mid mb-4">
                  Choose a visual theme that resonates with your cultivation path. Each theme transforms the entire interface.
                </p>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  {([
                    { id: "midnight-ink" as const, name: "Midnight Ink", desc: "Deep void & jade", colors: ["#0d0f14", "#1a1e2e", "#3a8f8f", "#c43030"] },
                    { id: "mountain-mist" as const, name: "Mountain Mist", desc: "Rice paper & ink", colors: ["#f5f0eb", "#c8c0b8", "#2d7a7a", "#a04040"] },
                    { id: "calligraphy" as const, name: "Calligraphy", desc: "Black & grey", colors: ["#1a1a1a", "#303030", "#5a5a5a", "#808080"] },
                    { id: "sakura" as const, name: "Sakura", desc: "Cherry blossom", colors: ["#faf6f5", "#f5d0d2", "#f5e0d0", "#b8c8d8"] },
                  ]).map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setThemeStyle(theme.id)}
                      className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                        themeStyle === theme.id
                          ? "border-jade/50 bg-jade-deep/20 shadow-[0_0_12px_rgba(58,143,143,0.2)]"
                          : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
                      }`}
                    >
                      <div className="flex gap-1 mb-1.5">
                        {theme.colors.map((c, i) => (
                          <div key={i} className="w-3 h-3 rounded-full border border-ink-light/30" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      <p className="text-[11px] font-medium text-cloud-white">{theme.name}</p>
                      <p className="text-[10px] text-mist-dark">{theme.desc}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setThemeStyle("sakura-dark")}
                  className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                    themeStyle === "sakura-dark"
                      ? "border-jade/50 bg-jade-deep/20 shadow-[0_0_12px_rgba(58,143,143,0.2)]"
                      : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
                  }`}
                >
                  <div className="flex gap-1 mb-1.5">
                    {["#0c080e", "#1a1420", "#d4508a", "#e898aa"].map((c, i) => (
                      <div key={i} className="w-3 h-3 rounded-full border border-ink-light/30" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <p className="text-[11px] font-medium text-cloud-white">Sakura Dark</p>
                  <p className="text-[10px] text-mist-dark">Deep sakura &amp; rose</p>
                </button>
              </WizardPage>
            )}

            {page === 1 && (
              <WizardPage key="display" title="Display Preferences" subtitle="Configure how techniques and cards appear">
                {/* Technique display mode */}
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Card Detail Level</p>
                    <p className="text-[10px] text-mist-dark mb-2">How much information to show on technique cards</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { value: "name-only", label: "Name Only", desc: "Minimal — just the name" },
                        { value: "name-illumination", label: "Name + Glow", desc: "Coloured by difficulty" },
                        { value: "name-illumination-realm", label: "+ Realm Badge", desc: "Shows difficulty level" },
                        { value: "name-illumination-realm-path", label: "Full Detail", desc: "All badges visible" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => updateSettings({ activeCardMode: opt.value, sidebarMode: opt.value, recentSessionsMode: opt.value })}
                          className={`p-2 rounded-md border text-left transition-all ${
                            settings.activeCardMode === opt.value
                              ? "bg-jade-deep/30 border-jade-glow/50 text-jade-glow"
                              : "border-ink-light text-mist-dark hover:text-mist-light hover:border-mist-dark"
                          }`}
                        >
                          <div className="text-[10px] font-medium">{opt.label}</div>
                          <div className="text-[9px] opacity-60 mt-0.5">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card style */}
                  <div>
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Visual Style</p>
                    <div className="flex rounded-md border border-ink-light overflow-hidden">
                      {([
                        { value: "default" as ActiveCardStyle, label: "Default", desc: "Clean bordered cards" },
                        { value: "scroll-card" as ActiveCardStyle, label: "Scroll", desc: "Emoji + rounded cards" },
                      ]).map((opt, idx) => (
                        <button
                          key={opt.value}
                          onClick={() => updateSettings({ activeCardStyle: opt.value, sidebarStyle: opt.value })}
                          className={`flex-1 px-3 py-2 text-center transition-all ${
                            settings.activeCardStyle === opt.value
                              ? "bg-jade-deep/30 text-jade-glow"
                              : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                          } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                        >
                          <div className="text-[10px] font-medium">{opt.label}</div>
                          <div className="text-[9px] opacity-60">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="mt-2 p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Live Preview</p>
                    <motion.div
                      key={previewIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`p-2 rounded-md border transition-all ${
                        settings.activeCardStyle === "scroll-card" ? "rounded-xl" : ""
                      }`}
                      style={{
                        borderColor: settings.activeCardMode !== "name-only"
                          ? getDifficultyGlowStyleScaled(preview.difficulty, settings.glowIntensityActiveCards ?? 100).borderColor ?? "var(--ink-light)"
                          : "var(--ink-light)",
                        boxShadow: settings.activeCardMode !== "name-only"
                          ? getDifficultyGlowStyleScaled(preview.difficulty, settings.glowIntensityActiveCards ?? 100).boxShadow
                          : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {settings.activeCardStyle === "scroll-card" && <span className="text-sm">{preview.emoji}</span>}
                        <div>
                          <span
                            className={`text-xs font-medium ${
                              settings.activeCardMode !== "name-only"
                                ? getDifficultyColorClass(preview.difficulty)
                                : "text-cloud-white"
                            }`}
                          >
                            {preview.name}
                          </span>
                          {(settings.activeCardMode === "name-illumination-realm" || settings.activeCardMode === "name-illumination-realm-path") && (
                            <div className="flex gap-1 mt-0.5">
                              <span
                                className="text-[9px] px-1 py-0 rounded border"
                                style={{
                                  color: getDifficultyGlowStyleScaled(preview.difficulty, 100).borderColor,
                                  borderColor: `${getDifficultyGlowStyleScaled(preview.difficulty, 100).borderColor}33`,
                                }}
                              >{preview.realm}</span>
                              {settings.activeCardMode === "name-illumination-realm-path" && (
                                <span className="text-[9px] text-mountain-blue-glow px-1 py-0 rounded border border-mountain-blue-glow/20">{preview.path}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </WizardPage>
            )}

            {page === 2 && (
              <WizardPage key="training" title="Training Table Settings" subtitle="Configure how training data is displayed">
                <div className="space-y-4">
                  {/* Column order */}
                  <div>
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Column Arrangement</p>
                    <p className="text-[10px] text-mist-dark mb-2">How weight (W) and rep (R) columns are ordered in tables</p>
                    <div className="flex rounded-md border border-ink-light overflow-hidden">
                      {([
                        { value: false, label: "Paired", desc: "W1, R1, W2, R2, W3, R3" },
                        { value: true, label: "Grouped", desc: "W1, W2, W3, R1, R2, R3" },
                      ]).map((opt, idx) => (
                        <button
                          key={String(opt.value)}
                          onClick={() => updateSettings({ columnOrderGrouped: opt.value })}
                          className={`flex-1 px-3 py-2 text-center transition-all ${
                            (settings.columnOrderGrouped ?? false) === opt.value
                              ? "bg-jade-deep/30 text-jade-glow"
                              : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                          } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                        >
                          <div className="text-[10px] font-medium">{opt.label}</div>
                          <div className="text-[9px] opacity-60">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Column colors toggle */}
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] text-mist-light font-medium">Column Colours</p>
                      <p className="text-[10px] text-mist-dark">Colour-code weight and rep columns</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={settings.columnColorsEnabled ?? true}
                      onClick={() => updateSettings({ columnColorsEnabled: !(settings.columnColorsEnabled ?? true) })}
                      className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.columnColorsEnabled ?? true) ? "bg-jade-glow" : "bg-ink-light"}`}
                    >
                      <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.columnColorsEnabled ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                    </button>
                  </div>

                  {/* Glow intensity */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <p className="text-[11px] text-mist-light font-medium">Glow Intensity</p>
                        <p className="text-[10px] text-mist-dark">Difficulty-based glow effect (applied to all)</p>
                      </div>
                      <span className="text-[10px] text-jade-glow font-medium tabular-nums">{settings.glowIntensityActiveCards ?? 100}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={settings.glowIntensityActiveCards ?? 100}
                      onChange={(e) => {
                        const v = parseInt(e.target.value);
                        updateSettings({ glowIntensityActiveCards: v, glowIntensitySidebar: v, glowIntensityRecentSessions: v });
                      }}
                      className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-jade-glow"
                    />
                  </div>

                  {/* Enhanced Table Preview with sample exercise data */}
                  <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Table Preview</p>
                    <table className="w-full text-[10px]">
                      <thead>
                        <tr className="border-b border-ink-light/40 text-mist-dark">
                          <th className="text-left py-1 px-1">Exercise</th>
                          {((settings.columnOrderGrouped ?? false) ? ["W1","W2","W3","R1","R2","R3"] : ["W1","R1","W2","R2","W3","R3"]).map(h => (
                            <th key={h} className="text-center py-1 px-0.5" style={
                              (settings.columnColorsEnabled ?? true) && h.startsWith("W") ? { color: "var(--col-weight, #4a8fb8)" }
                              : (settings.columnColorsEnabled ?? true) && h.startsWith("R") ? { color: "var(--col-reps, #b8884a)" }
                              : undefined
                            }>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PREVIEW_TABLE_ROWS.map((row, ri) => {
                          const glowStyle = getDifficultyGlowStyleScaled(row.difficulty, settings.glowIntensityActiveCards ?? 100);
                          const colorClass = getDifficultyColorClass(row.difficulty);
                          const vals = (settings.columnOrderGrouped ?? false)
                            ? [...row.w, ...row.r]
                            : [row.w[0], row.r[0], row.w[1], row.r[1], row.w[2], row.r[2]];
                          return (
                            <tr
                              key={ri}
                              className="border-b border-ink-light/20 transition-all"
                              style={glowStyle.boxShadow ? { boxShadow: glowStyle.boxShadow } : undefined}
                            >
                              <td className={`py-1 px-1 ${colorClass}`}>{row.name}</td>
                              {vals.map((v, i) => (
                                <td key={i} className="py-1 px-0.5 text-center text-cloud-white">{v}</td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </WizardPage>
            )}

            {page === 3 && (
              <WizardPage key="colours" title="Cultivation Colours" subtitle="Difficulty tiers and check-in colour assignments">
                <div className="space-y-4">
                  <p className="text-[10px] text-mist-dark">
                    Each difficulty level has a unique colour used for technique cards, glow effects, and check-in completion ticks throughout the application.
                  </p>

                  {/* Difficulty colour grid */}
                  <div className="space-y-1.5">
                    {CULTIVATION_COLOURS.map((c) => {
                      const glowStyle = getDifficultyGlowStyleScaled(c.level, settings.glowIntensityActiveCards ?? 100);
                      return (
                        <div
                          key={c.level}
                          className="flex items-center gap-3 p-2 rounded-lg border border-ink-light/30 transition-all"
                          style={glowStyle.boxShadow ? { boxShadow: glowStyle.boxShadow, borderColor: glowStyle.borderColor } : undefined}
                        >
                          {/* Colour swatch */}
                          <div
                            className="w-5 h-5 rounded-full shrink-0 border border-ink-light/20"
                            style={{ backgroundColor: c.color, boxShadow: `0 0 8px ${c.color}66` }}
                          />
                          {/* Check tick preview */}
                          <div className="w-5 h-5 shrink-0 rounded flex items-center justify-center" style={{ backgroundColor: `${c.color}20` }}>
                            <svg className="w-3 h-3" fill="none" stroke={c.color} viewBox="0 0 24 24" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          {/* Labels */}
                          <div className="flex-1 min-w-0">
                            <span className={`text-[11px] font-medium ${getDifficultyColorClass(c.level)}`}>
                              {c.level}
                            </span>
                          </div>
                          {/* Preview bar */}
                          <div className="w-16 h-1.5 rounded-full bg-ink-dark overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ backgroundColor: c.color, width: "70%" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[9px] text-mist-dark text-center mt-2">
                    These colours adapt to your selected theme for optimal visibility.
                  </p>
                </div>
              </WizardPage>
            )}

            {page === 4 && (
              <WizardPage key="experience" title="Experience & Progression" subtitle="Configure gamification and XP features">
                <div className="space-y-4">
                  <p className="text-[10px] text-mist-dark">
                    The application includes an experience point (XP) system with cultivation realms. 
                    You earn XP by completing workouts and checking in. Toggle this feature to show or hide all gamification content.
                  </p>

                  {/* Toggle with clear visual feedback */}
                  <div className="p-4 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[12px] text-mist-light font-semibold">Experience &amp; Progression</p>
                        <p className="text-[10px] text-mist-dark">Show XP, realms, and gamification features</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={settings.gamificationVisible ?? true}
                        onClick={() => updateSettings({ gamificationVisible: !(settings.gamificationVisible ?? true) })}
                        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors duration-300 ${(settings.gamificationVisible ?? true) ? "bg-jade-glow" : "bg-ink-light"}`}
                      >
                        <span className={`absolute top-[3px] left-[3px] w-[16px] h-[16px] rounded-full bg-cloud-white shadow transition-transform duration-300 ${(settings.gamificationVisible ?? true) ? "translate-x-[18px]" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {/* State indicator with clear feedback */}
                    <motion.div
                      key={String(settings.gamificationVisible ?? true)}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-all ${
                        (settings.gamificationVisible ?? true)
                          ? "border-jade-glow/30 bg-jade-deep/20"
                          : "border-ink-light/30 bg-ink-dark/30"
                      }`}
                    >
                      <span className="text-base">
                        {(settings.gamificationVisible ?? true) ? "✨" : "🔇"}
                      </span>
                      <div>
                        <p className={`text-[11px] font-medium ${(settings.gamificationVisible ?? true) ? "text-jade-glow" : "text-mist-dark"}`}>
                          {(settings.gamificationVisible ?? true) ? "Enabled — XP, realms, and progression visible" : "Disabled — All gamification content hidden"}
                        </p>
                        <p className="text-[9px] text-mist-dark mt-0.5">
                          {(settings.gamificationVisible ?? true)
                            ? "Top bar shows XP, streak, and realm info. Quick View panel visible."
                            : "Top bar, Quick View, and realm displays are hidden throughout the app."}
                        </p>
                      </div>
                    </motion.div>
                  </div>

                  {/* Preview of what's shown/hidden */}
                  <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Preview</p>
                    <div className={`space-y-1.5 transition-opacity ${(settings.gamificationVisible ?? true) ? "opacity-100" : "opacity-30"}`}>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span>⚡</span>
                        <span className="text-mist-light">150 XP</span>
                        <span className="text-mist-dark">•</span>
                        <span className="text-jade-glow">Foundation Establishment</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-ink-dark overflow-hidden">
                        <div className="h-full rounded-full bg-jade-glow/60 w-3/5" />
                      </div>
                      <p className="text-[9px] text-mist-dark">50 XP to next realm</p>
                    </div>
                    {!(settings.gamificationVisible ?? true) && (
                      <p className="text-[9px] text-mist-dark text-center mt-2 italic">Content hidden when disabled</p>
                    )}
                  </div>
                </div>
              </WizardPage>
            )}

            {page === 5 && (
              <WizardPage key="terminology" title="Terminology Mode" subtitle="Choose your preferred interface language style">
                <div className="space-y-4">
                  <p className="text-[10px] text-mist-dark">
                    The application uses wuxia-inspired cultivation terminology by default. 
                    You can switch to conventional fitness terminology if you prefer standard language.
                    Difficulty level names are preserved in both modes.
                  </p>

                  {/* Mode selector */}
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([
                      { value: "fantasy" as const, label: "🏯 Cultivation", desc: "Wuxia-themed terms" },
                      { value: "normal" as const, label: "🏋️ Conventional", desc: "Standard fitness terms" },
                    ]).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ terminologyMode: opt.value })}
                        className={`flex-1 px-3 py-2.5 text-center transition-all ${
                          settings.terminologyMode === opt.value
                            ? "bg-jade-deep/30 text-jade-glow"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        <div className="text-[11px] font-medium">{opt.label}</div>
                        <div className="text-[9px] opacity-60">{opt.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Side-by-side comparison */}
                  <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Comparison Preview</p>
                    <div className="space-y-1">
                      <div className="grid grid-cols-2 gap-2 text-[9px] text-mist-dark uppercase tracking-wider pb-1 border-b border-ink-light/30">
                        <span>🏯 Cultivation</span>
                        <span>🏋️ Conventional</span>
                      </div>
                      {TERMINOLOGY_COMPARISONS.map((pair) => (
                        <div key={pair.fantasy} className="grid grid-cols-2 gap-2 py-0.5">
                          <span className={`text-[10px] ${settings.terminologyMode === "fantasy" ? "text-jade-glow font-medium" : "text-mist-dark"}`}>
                            {pair.fantasy}
                          </span>
                          <span className={`text-[10px] ${settings.terminologyMode === "normal" ? "text-jade-glow font-medium" : "text-mist-dark"}`}>
                            {pair.normal}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dynamic preview of nav labels */}
                  <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Navigation Preview</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["Dao Hall", "Training Grounds", "Technique Scroll", "Sect Register", "Cultivation Path"].map((label) => (
                        <span key={label} className="text-[10px] px-2 py-1 rounded-md border border-ink-light/30 bg-ink-dark/30 text-mist-light">
                          {t(label, settings.terminologyMode)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </WizardPage>
            )}

            {page === 6 && (
              <WizardPage key="layout" title="Layout & Preferences" subtitle="Final layout configuration options">
                <div className="space-y-4">
                  {/* Sidebar position */}
                  <div>
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Sidebar Position</p>
                    <p className="text-[10px] text-mist-dark mb-2">Position of the technique panel on Training Grounds</p>
                    <div className="flex rounded-md border border-ink-light overflow-hidden">
                      {([
                        { value: "left" as const, label: "◧ Left" },
                        { value: "right" as const, label: "◨ Right" },
                      ]).map((opt, idx) => (
                        <button
                          key={opt.value}
                          onClick={() => updateSettings({ sidebarPosition: opt.value })}
                          className={`flex-1 px-3 py-2 text-[11px] font-medium text-center transition-all ${
                            settings.sidebarPosition === opt.value
                              ? "bg-jade-deep/30 text-jade-glow"
                              : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                          } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date format */}
                  <div>
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Date Format</p>
                    <p className="text-[10px] text-mist-dark mb-2">How dates are displayed throughout the interface</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([
                        { value: "dd-mm-yyyy" as DateFormatOption, label: "DD-MM-YYYY", example: "13-03-2026" },
                        { value: "dd-mmm-yyyy" as DateFormatOption, label: "DD-MMM-YYYY", example: "13-Mar-2026" },
                        { value: "dd-mm-yy" as DateFormatOption, label: "DD-MM-YY", example: "13-03-26" },
                        { value: "dd-mmm-yy" as DateFormatOption, label: "DD-MMM-YY", example: "13-Mar-26" },
                      ]).map((fmt) => (
                        <button
                          key={fmt.value}
                          onClick={() => updateSettings({ dateFormat: fmt.value })}
                          className={`px-2 py-1.5 rounded-md border text-left transition-all ${
                            settings.dateFormat === fmt.value
                              ? "bg-jade-deep/30 border-jade-glow/50 text-jade-glow"
                              : "border-ink-light text-mist-dark hover:text-mist-light hover:border-mist-dark"
                          }`}
                        >
                          <div className="text-[10px] font-medium">{fmt.label}</div>
                          <div className="text-[9px] opacity-60 mt-0.5">{fmt.example}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </WizardPage>
            )}

            {page === 7 && (
              <WizardPage key="complete" title="Setup Complete" subtitle="Your cultivation path is prepared">
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2, type: "spring" }}
                      className="text-4xl mb-2"
                    >
                      ✨
                    </motion.div>
                    <p className="text-xs text-mist-mid">
                      All preferences can be changed later in {t("Inner Chamber", settings.terminologyMode)} ({t("Inner Chamber", settings.terminologyMode) === "Inner Chamber" ? "Settings" : ""}).
                    </p>
                  </div>

                  {/* Save to Preset option */}
                  <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
                    <p className="text-[11px] text-mist-light font-medium mb-1.5">Save to Preset (Optional)</p>
                    <p className="text-[10px] text-mist-dark mb-3">
                      Save your configured preferences to a display preset slot for future recall.
                    </p>
                    <div className="space-y-1.5">
                      {Array.from({ length: PRESET_SLOT_COUNT }).map((_, i) => {
                        const preset = presets[i];
                        const isSelected = selectedPresetSlot === i;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedPresetSlot(isSelected ? null : i)}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-all ${
                              isSelected
                                ? "border-jade-glow/50 bg-jade-deep/20 text-jade-glow"
                                : "border-ink-light/30 text-mist-dark hover:text-mist-light hover:border-mist-dark"
                            }`}
                          >
                            <span className="text-[10px] font-mono w-5 shrink-0">{i + 1}</span>
                            <span className="text-[10px] flex-1 truncate">
                              {preset ? `${preset.name} (overwrite)` : "Empty slot"}
                            </span>
                            {isSelected && (
                              <svg className="w-3 h-3 text-jade-glow shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedPresetSlot === null && (
                      <p className="text-[9px] text-mist-dark mt-2 text-center">No preset selected — settings will still be applied</p>
                    )}
                  </div>
                </div>
              </WizardPage>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-auto pt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {page > 0 ? (
                <GlowButton variant="ghost" size="sm" onClick={prev} className="!text-[11px]">
                  ← Back
                </GlowButton>
              ) : (
                <button onClick={handleSkip} className="text-[11px] text-mist-dark hover:text-mist-light transition-colors">
                  Skip Setup
                </button>
              )}
            </div>

            {/* Page indicators */}
            <div className="flex gap-1">
              {Array.from({ length: TOTAL_PAGES }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === page ? "bg-jade-glow scale-125" : i < page ? "bg-jade-glow/40" : "bg-ink-light"
                  }`}
                />
              ))}
            </div>

            {page < TOTAL_PAGES - 1 ? (
              <GlowButton variant="jade" size="sm" onClick={next} className="!text-[11px]">
                Next →
              </GlowButton>
            ) : (
              <GlowButton variant="jade" size="sm" glow onClick={handleComplete} className="!text-[11px]">
                Begin Cultivation ✦
              </GlowButton>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function WizardPage({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      className="flex-1 flex flex-col"
    >
      <div className="mb-4">
        <h2 className="text-base font-semibold text-jade-glow">{title}</h2>
        <p className="text-[11px] text-mist-dark mt-0.5">{subtitle}</p>
        <div className="mt-2 w-12 h-px bg-gradient-to-r from-jade-glow to-transparent" />
      </div>
      <div className="flex-1 overflow-y-auto pr-1 sidebar-scroll">
        {children}
      </div>
    </motion.div>
  );
}
