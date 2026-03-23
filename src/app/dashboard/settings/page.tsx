"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  TechniqueDisplayMode,
  RecentSessionsCompactMode,
  DateFormatOption,
  ActiveCardStyle,
  VariationDisplayMode,
  UnifiedVisibleColumnKey,
  DEFAULT_UNIFIED_VISIBLE_COLUMNS,
  PopupLoggerStyle,
  WeightUnitPref,
} from "@/context/DisplaySettingsContext";
import PresetSlots from "@/components/ui/PresetSlots";
import SetupWizard from "@/components/ui/SetupWizard";
import { t } from "@/lib/terminology";

function SettingRow({
  label,
  value,
  color = "text-jade-glow",
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[10px] text-mist-dark">{label}</span>
      <span className={`text-[10px] font-medium ${color}`}>{value}</span>
    </div>
  );
}

function getColumnOptionLabelClass(label: string) {
  return /^(W|R|T|S)\d$/.test(label)
    ? "inline-flex min-w-[2.25rem] justify-center font-semibold tabular-nums tracking-[0.08em]"
    : "inline-flex min-w-0";
}

const UNIFIED_COLUMN_OPTIONS: Array<{ key: UnifiedVisibleColumnKey; label: string }> = [
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: "val1", label: "S1" },
  { key: "val2", label: "S2" },
  { key: "val3", label: "S3" },
  { key: "reps1", label: "R1" },
  { key: "reps2", label: "R2" },
  { key: "reps3", label: "R3" },
  { key: "modifier", label: "Modifier" },
  { key: "band", label: "Band" },
  { key: "variant", label: "Variant" },
  { key: "notes", label: "Notes" },
  { key: "standardWeight", label: "Std Wt" },
  { key: "avgWeight", label: "Avg Wt" },
];

function SettingsSidebar({ onLogout }: { onLogout: () => void }) {
  const { themeStyle, viewportMode } = useAppContext();
  const { settings } = useDisplaySettings();

  const themeLabels: Record<string, string> = {
    "midnight-ink": "Midnight Ink",
    "mountain-mist": "Mountain Mist",
    "calligraphy": "Calligraphy",
    "sakura": "Sakura",
    "sakura-dark": "Sakura Dark",
  };

  const modeLabels: Record<string, string> = {
    "name-only": "Name Only",
    "name-illumination": "Name + Glow",
    "name-illumination-realm": "+ Realm",
    "name-illumination-realm-path": "Full",
  };

  const styleLabels: Record<string, string> = {
    "default": "Default",
    "scroll-card": "Scroll Card",
  };

  const dateLabels: Record<string, string> = {
    "dd-mm-yyyy": "DD-MM-YYYY",
    "dd-mmm-yyyy": "DD-MMM-YYYY",
    "dd-mm-yy": "DD-MM-YY",
    "dd-mmm-yy": "DD-MMM-YY",
  };

  return (
    <div className="space-y-3">
      {/* Settings Overview */}
      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-[10px] text-gold uppercase tracking-wider mb-2 font-semibold">🎨 Appearance</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Theme" value={themeLabels[themeStyle] || themeStyle} color="text-gold" />
        </div>
      </div>

      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-[10px] text-jade-glow uppercase tracking-wider mb-2 font-semibold">📋 Display</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Active Cards" value={modeLabels[settings.activeCardMode] || settings.activeCardMode} />
          <SettingRow label="Card Style" value={styleLabels[settings.activeCardStyle] || settings.activeCardStyle} />
          <SettingRow label="Compact" value={settings.activeCardCompact ? "On" : "Off"} color={settings.activeCardCompact ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Notes Visible" value={settings.activeCardNotesAlwaysVisible ? "Always" : "Toggle"} />
          <SettingRow label="Sessions" value={modeLabels[settings.recentSessionsMode] || settings.recentSessionsMode} />
          <SettingRow label="Sessions Compact" value={settings.recentSessionsCompact} />
          <SettingRow label="Sidebar" value={modeLabels[settings.sidebarMode] || settings.sidebarMode} />
          <SettingRow label="Sidebar Style" value={styleLabels[settings.sidebarStyle] || settings.sidebarStyle} />
          <SettingRow label="Card Glow" value={`${settings.glowIntensityActiveCards ?? 100}%`} color={(settings.glowIntensityActiveCards ?? 100) > 0 ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Sessions Glow" value={`${settings.glowIntensityRecentSessions ?? 100}%`} color={(settings.glowIntensityRecentSessions ?? 100) > 0 ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Sidebar Glow" value={`${settings.glowIntensitySidebar ?? 100}%`} color={(settings.glowIntensitySidebar ?? 100) > 0 ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Card Lore" value={(settings.activeCardLoreVisible ?? true) ? "Visible" : "Hidden"} color={(settings.activeCardLoreVisible ?? true) ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Sidebar Lore" value={(settings.sidebarLoreVisible ?? true) ? "Visible" : "Hidden"} color={(settings.sidebarLoreVisible ?? true) ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Column Colours" value={(settings.columnColorsEnabled ?? true) ? "On" : "Off"} color={(settings.columnColorsEnabled ?? true) ? "text-jade-glow" : "text-mist-dark"} />
          <SettingRow label="Column Order" value={(settings.columnOrderGrouped ?? false) ? "Grouped" : "Paired"} color="text-jade-glow" />
        </div>
      </div>

      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-[10px] text-gold uppercase tracking-wider mb-2 font-semibold">🏛️ Progression</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Sidebar" value={modeLabels[settings.progressionSidebarMode] || settings.progressionSidebarMode} color="text-gold" />
          <SettingRow label="Sidebar Style" value={styleLabels[settings.progressionSidebarStyle] || settings.progressionSidebarStyle} color="text-gold" />
          <SettingRow label="Cards" value={modeLabels[settings.progressionCardMode] || settings.progressionCardMode} color="text-gold" />
          <SettingRow label="Card Style" value={styleLabels[settings.progressionCardStyle] || settings.progressionCardStyle} color="text-gold" />
          <SettingRow label="Card Compact" value={(settings.progressionCardCompact ?? false) ? "On" : "Off"} color={(settings.progressionCardCompact ?? false) ? "text-gold" : "text-mist-dark"} />
          <SettingRow label="Log" value={modeLabels[settings.progressionLogMode] || settings.progressionLogMode} color="text-gold" />
          <SettingRow label="Log Compact" value={settings.progressionLogCompact ?? "auto"} color="text-gold" />
          <SettingRow label="Variation Text" value={(settings.progressionVariationDisplay ?? "abbreviation") === "full" ? "Full" : "Abbrev"} color="text-gold" />
          <SettingRow label="Sidebar Glow" value={`${settings.glowIntensityProgressionSidebar ?? 100}%`} color={(settings.glowIntensityProgressionSidebar ?? 100) > 0 ? "text-gold" : "text-mist-dark"} />
          <SettingRow label="Card Glow" value={`${settings.glowIntensityProgressionCards ?? 100}%`} color={(settings.glowIntensityProgressionCards ?? 100) > 0 ? "text-gold" : "text-mist-dark"} />
          <SettingRow label="Log Glow" value={`${settings.glowIntensityProgressionLog ?? 100}%`} color={(settings.glowIntensityProgressionLog ?? 100) > 0 ? "text-gold" : "text-mist-dark"} />
          <SettingRow label="Click Mode" value={(settings.progressionSidebarExpandTiers ?? true) ? "Expanded" : "Basic"} color="text-gold" />
          <SettingRow label="Weight Unit" value={(settings.defaultWeightUnit ?? "kg").toUpperCase()} color="text-gold" />
          <SettingRow label="Logger Style" value={(settings.popupLoggerStyle ?? "classic").charAt(0).toUpperCase() + (settings.popupLoggerStyle ?? "classic").slice(1)} color="text-gold" />
        </div>
      </div>

      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-[10px] text-mountain-blue-glow uppercase tracking-wider mb-2 font-semibold">⚙️ Layout</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Viewport" value={viewportMode === "auto" ? "Auto" : viewportMode === "mobile" ? "Mobile" : "Desktop"} color="text-mountain-blue-glow" />
          <SettingRow label="Panel Position" value={settings.sidebarPosition === "left" ? "Left" : "Right"} color="text-mountain-blue-glow" />
          <SettingRow label="Quick View" value={settings.rightPanelVisible ? "Visible" : "Hidden"} color={settings.rightPanelVisible ? "text-mountain-blue-glow" : "text-mist-dark"} />
          <SettingRow label="Date Format" value={dateLabels[settings.dateFormat] || settings.dateFormat} color="text-mountain-blue-glow" />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-[10px] text-crimson-glow uppercase tracking-wider mb-2 font-semibold">⚡ Quick Actions</h3>
        <div className="space-y-1.5">
          <GlowButton
            variant="crimson"
            size="sm"
            className="w-full !text-[10px]"
            onClick={onLogout}
          >
            🚪 Logout
          </GlowButton>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { logout } = useAuth();
  const {
    themeStyle,
    setThemeStyle,
    viewportMode,
    setViewportMode,
  } = useAppContext();
  const { settings, updateSettings, resetSettings } = useDisplaySettings();
  const [showWizard, setShowWizard] = useState(false);
  const visibleUnifiedColumns = settings.unifiedVisibleColumns ?? DEFAULT_UNIFIED_VISIBLE_COLUMNS;
  const toggleUnifiedColumn = (key: UnifiedVisibleColumnKey) => {
    const next = visibleUnifiedColumns.includes(key)
      ? visibleUnifiedColumns.filter((c) => c !== key)
      : [...visibleUnifiedColumns, key];
    updateSettings({ unifiedVisibleColumns: next });
  };

  return (
    <PageLayout
      title="Inner Chamber"
      subtitle="Configure your cultivation environment"
      sidebar={<SettingsSidebar onLogout={logout} />}
    >
      <div className="space-y-6 max-w-2xl">

        {/* ══════════════════════════════════════════════════════════
            SECTION 0: DISPLAY PRESETS — Save, Load, Manage (TOP)
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-2">
            Display Presets
          </h3>
          <p className="text-xs text-mist-dark mb-4">
            Save your current display configuration to a preset slot for quick recall. Each slot stores the complete state of all display settings.
          </p>
          <PresetSlots variant="full" />
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 1: APPEARANCE — Theme & Visual Identity
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="gold" hoverable={false}>
          <h3 className="text-sm text-gold uppercase tracking-wider mb-4">
            Appearance
          </h3>

          {/* Theme Selector Cards */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("midnight-ink")}
              className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "midnight-ink"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#0d0f14]" />
                <div className="w-3 h-3 rounded-full bg-[#1a1e2e]" />
                <div className="w-3 h-3 rounded-full bg-[#3a8f8f]" />
                <div className="w-3 h-3 rounded-full bg-[#c43030]" />
              </div>
              <p className="text-xs font-medium text-cloud-white">Midnight Ink</p>
              <p className="text-[10px] text-mist-dark">Deep void &amp; jade</p>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("mountain-mist")}
              className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "mountain-mist"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#f5f0eb]" />
                <div className="w-3 h-3 rounded-full bg-[#c8c0b8]" />
                <div className="w-3 h-3 rounded-full bg-[#2d7a7a]" />
                <div className="w-3 h-3 rounded-full bg-[#a04040]" />
              </div>
              <p className="text-xs font-medium text-cloud-white">Mountain Mist</p>
              <p className="text-[10px] text-mist-dark">Rice paper &amp; ink</p>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("calligraphy")}
              className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "calligraphy"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#1a1a1a]" />
                <div className="w-3 h-3 rounded-full bg-[#303030]" />
                <div className="w-3 h-3 rounded-full bg-[#5a5a5a]" />
                <div className="w-3 h-3 rounded-full bg-[#808080]" />
              </div>
              <p className="text-xs font-medium text-cloud-white">Calligraphy</p>
              <p className="text-[10px] text-mist-dark">Black &amp; grey</p>
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("sakura")}
              className={`p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "sakura"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#faf6f5]" />
                <div className="w-3 h-3 rounded-full bg-[#f5d0d2]" />
                <div className="w-3 h-3 rounded-full bg-[#f5e0d0]" />
                <div className="w-3 h-3 rounded-full bg-[#b8c8d8]" />
              </div>
              <p className="text-xs font-medium text-cloud-white">Sakura</p>
              <p className="text-[10px] text-mist-dark">Cherry blossom</p>
            </motion.button>
          </div>
          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("sakura-dark")}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "sakura-dark"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full bg-[#0c080e]" />
                <div className="w-3 h-3 rounded-full bg-[#1a1420]" />
                <div className="w-3 h-3 rounded-full bg-[#d4508a]" />
                <div className="w-3 h-3 rounded-full bg-[#e898aa]" />
              </div>
              <p className="text-xs font-medium text-cloud-white">Sakura Dark</p>
              <p className="text-[10px] text-mist-dark">Deep sakura &amp; rose</p>
            </motion.button>
          </div>

          <div className="flex gap-2">
            {[
              "bg-jade-glow",
              "bg-crimson",
              "bg-gold",
              "bg-mountain-blue-glow",
              "bg-ink-deep",
              "bg-mist-light",
            ].map((color) => (
              <div
                key={color}
                className={`w-6 h-6 rounded-full ${color} border border-ink-light transition-colors duration-500`}
              />
            ))}
          </div>
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2: DISPLAY — Restructured by feature area
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-4">
            Display Settings
          </h3>

          <div className="space-y-6">

            {/* ── Technique Cards ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🎴</span>
                <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">Technique Cards</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Control how active technique cards appear on the dashboard</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.activeCardMode}
                    onChange={(e) => updateSettings({ activeCardMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Visual style</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "default", label: "Default" }, { value: "scroll-card", label: "Scroll" }]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ activeCardStyle: opt.value as ActiveCardStyle })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          settings.activeCardStyle === opt.value
                            ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${opt.value !== "default" ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Compact cards</span>
                  <button type="button" role="switch" aria-checked={settings.activeCardCompact} onClick={() => updateSettings({ activeCardCompact: !settings.activeCardCompact })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${settings.activeCardCompact ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${settings.activeCardCompact ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Always show notes</span>
                  <button type="button" role="switch" aria-checked={settings.activeCardNotesAlwaysVisible} onClick={() => updateSettings({ activeCardNotesAlwaysVisible: !settings.activeCardNotesAlwaysVisible })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${settings.activeCardNotesAlwaysVisible ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${settings.activeCardNotesAlwaysVisible ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Lore text</span>
                  <button type="button" role="switch" aria-checked={settings.activeCardLoreVisible ?? true} onClick={() => updateSettings({ activeCardLoreVisible: !(settings.activeCardLoreVisible ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.activeCardLoreVisible ?? true) ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.activeCardLoreVisible ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-jade-glow font-medium tabular-nums w-8 text-right">{settings.glowIntensityActiveCards ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensityActiveCards ?? 100} onChange={(e) => updateSettings({ glowIntensityActiveCards: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-jade-glow" />
                </div>
              </div>
            </div>

            {/* ── Session History ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📜</span>
                <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">Session History</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Configure the recent sessions table display</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.recentSessionsMode}
                    onChange={(e) => updateSettings({ recentSessionsMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Layout density</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "auto", label: "Auto" }, { value: "compact", label: "Compact" }, { value: "full", label: "Full" }]).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ recentSessionsCompact: opt.value as RecentSessionsCompactMode })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          settings.recentSessionsCompact === opt.value
                            ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-jade-glow font-medium tabular-nums w-8 text-right">{settings.glowIntensityRecentSessions ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensityRecentSessions ?? 100} onChange={(e) => updateSettings({ glowIntensityRecentSessions: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-jade-glow" />
                </div>
              </div>
            </div>

            {/* ── Sidebar Panel ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📑</span>
                <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">Sidebar Panel</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Adjust sidebar appearance and content</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.sidebarMode}
                    onChange={(e) => updateSettings({ sidebarMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Visual style</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "default", label: "Default" }, { value: "scroll-card", label: "Scroll" }]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ sidebarStyle: opt.value as ActiveCardStyle })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          settings.sidebarStyle === opt.value
                            ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${opt.value !== "default" ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Lore text</span>
                  <button type="button" role="switch" aria-checked={settings.sidebarLoreVisible ?? true} onClick={() => updateSettings({ sidebarLoreVisible: !(settings.sidebarLoreVisible ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.sidebarLoreVisible ?? true) ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.sidebarLoreVisible ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-jade-glow font-medium tabular-nums w-8 text-right">{settings.glowIntensitySidebar ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensitySidebar ?? 100} onChange={(e) => updateSettings({ glowIntensitySidebar: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-jade-glow" />
                </div>
              </div>
            </div>

            {/* ── Layout & Interface ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📐</span>
                <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">Layout &amp; Interface</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Panel positioning, visibility, and interface options</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Viewport mode</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([
                      { value: "mobile" as const, label: "📱 Mobile" },
                      { value: "desktop" as const, label: "🖥️ Desktop" },
                    ]).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => setViewportMode(opt.value)}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          viewportMode === opt.value
                            ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                        aria-pressed={viewportMode === opt.value}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Follow device automatically</span>
                  <button
                    type="button"
                    onClick={() => setViewportMode("auto")}
                    className={`text-[10px] px-2.5 py-1 rounded-md border transition-all ${
                      viewportMode === "auto"
                        ? "border-jade-glow/40 bg-jade-deep/20 text-jade-glow"
                        : "border-ink-light text-mist-dark hover:text-mist-light hover:border-mist-dark"
                    }`}
                    aria-pressed={viewportMode === "auto"}
                  >
                    {viewportMode === "auto" ? "Auto Mode Active" : "Switch to Auto"}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Panel position</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "left", label: "◧ Left" }, { value: "right", label: "◨ Right" }]).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ sidebarPosition: opt.value as "left" | "right" })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          settings.sidebarPosition === opt.value
                            ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Quick View panel</span>
                  <button type="button" role="switch" aria-checked={settings.rightPanelVisible} onClick={() => updateSettings({ rightPanelVisible: !settings.rightPanelVisible })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${settings.rightPanelVisible ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${settings.rightPanelVisible ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Column colours (W/R)</span>
                  <button type="button" role="switch" aria-checked={settings.columnColorsEnabled ?? true} onClick={() => updateSettings({ columnColorsEnabled: !(settings.columnColorsEnabled ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.columnColorsEnabled ?? true) ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.columnColorsEnabled ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <span className="text-[11px] text-mist-light shrink-0 block">Column order</span>
                    <span className="text-[9px] text-mist-dark block mt-0.5">
                      {settings.columnOrderGrouped ? "W1, W2, W3, R1, R2, R3 (grouped)" : "W1, R1, W2, R2, W3, R3 (paired)"}
                    </span>
                  </div>
                  <button type="button" role="switch" aria-checked={settings.columnOrderGrouped ?? false} onClick={() => updateSettings({ columnOrderGrouped: !(settings.columnOrderGrouped ?? false) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.columnOrderGrouped ?? false) ? "bg-jade-glow" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.columnOrderGrouped ?? false) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>
            </div>

          </div>

          {/* Reset */}
          <div className="pt-4 mt-5 border-t border-ink-light/30">
            <button
              onClick={resetSettings}
              className="w-full text-xs text-mist-dark hover:text-mist-light py-2 rounded-lg border border-ink-light hover:border-mist-dark transition-colors"
            >
              Reset Display Settings to Defaults
            </button>
          </div>
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 2B: PROGRESSION DISPLAY SETTINGS
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="gold" hoverable={false}>
          <h3 className="text-sm text-gold uppercase tracking-wider mb-4">
            Progression Display
          </h3>

          <div className="space-y-6">

            {/* ── Progression Sidebar ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📑</span>
                <h4 className="text-[11px] font-semibold text-gold uppercase tracking-wider">Progression Sidebar</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Adjust progression sidebar appearance</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.progressionSidebarMode ?? "name-illumination-realm"}
                    onChange={(e) => updateSettings({ progressionSidebarMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Visual style</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "default", label: "Default" }, { value: "scroll-card", label: "Scroll" }]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ progressionSidebarStyle: opt.value as ActiveCardStyle })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionSidebarStyle ?? "default") === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${opt.value !== "default" ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Lore text</span>
                  <button type="button" role="switch" aria-checked={settings.progressionSidebarLoreVisible ?? true} onClick={() => updateSettings({ progressionSidebarLoreVisible: !(settings.progressionSidebarLoreVisible ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.progressionSidebarLoreVisible ?? true) ? "bg-gold" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.progressionSidebarLoreVisible ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-mist-light shrink-0">Click mode</span>
                    <span className="text-[9px] text-mist-dark">{(settings.progressionSidebarExpandTiers ?? true) ? "Expand tiers, pick level with +" : "Click to add, change level in log form"}</span>
                  </div>
                  <div className="flex rounded-md border border-ink-light overflow-hidden shrink-0">
                    {([{ value: true, label: "Expanded" }, { value: false, label: "Basic" }] as const).map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => updateSettings({ progressionSidebarExpandTiers: opt.value })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionSidebarExpandTiers ?? true) === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${!opt.value ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-gold font-medium tabular-nums w-8 text-right">{settings.glowIntensityProgressionSidebar ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensityProgressionSidebar ?? 100} onChange={(e) => updateSettings({ glowIntensityProgressionSidebar: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-gold" />
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] text-mist-light shrink-0">Colour mode</span>
                    <span className="text-[9px] text-mist-dark">{(settings.progressionSidebarUseThemeColor ?? false) ? "Use theme colour for all exercises" : "Colour based on weight tier"}</span>
                  </div>
                  <div className="flex rounded-md border border-ink-light overflow-hidden shrink-0">
                    {([{ value: false, label: "Tier" }, { value: true, label: "Theme" }] as const).map((opt) => (
                      <button
                        key={String(opt.value)}
                        onClick={() => updateSettings({ progressionSidebarUseThemeColor: opt.value })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionSidebarUseThemeColor ?? false) === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${opt.value ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Progression Cards ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">🎴</span>
                <h4 className="text-[11px] font-semibold text-gold uppercase tracking-wider">Progression Cards</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Control how active progression cards appear when logging</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.progressionCardMode ?? "name-illumination-realm-path"}
                    onChange={(e) => updateSettings({ progressionCardMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Visual style</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "default", label: "Default" }, { value: "scroll-card", label: "Scroll" }]).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ progressionCardStyle: opt.value as ActiveCardStyle })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionCardStyle ?? "default") === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${opt.value !== "default" ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Compact cards</span>
                  <button type="button" role="switch" aria-checked={settings.progressionCardCompact ?? false} onClick={() => updateSettings({ progressionCardCompact: !(settings.progressionCardCompact ?? false) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.progressionCardCompact ?? false) ? "bg-gold" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.progressionCardCompact ?? false) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Lore text</span>
                  <button type="button" role="switch" aria-checked={settings.progressionCardLoreVisible ?? true} onClick={() => updateSettings({ progressionCardLoreVisible: !(settings.progressionCardLoreVisible ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.progressionCardLoreVisible ?? true) ? "bg-gold" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.progressionCardLoreVisible ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-gold font-medium tabular-nums w-8 text-right">{settings.glowIntensityProgressionCards ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensityProgressionCards ?? 100} onChange={(e) => updateSettings({ glowIntensityProgressionCards: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-gold" />
                </div>
              </div>
            </div>

            {/* ── Progression Training Log ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm">📜</span>
                <h4 className="text-[11px] font-semibold text-gold uppercase tracking-wider">Training Log</h4>
                <div className="flex-1 h-px bg-ink-light/30" />
              </div>
              <p className="text-[10px] text-mist-dark mb-3 pl-1">Configure the progression training log table</p>
              <div className="space-y-2 pl-1">
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Detail level</span>
                  <select
                    value={settings.progressionLogMode ?? "name-illumination-realm"}
                    onChange={(e) => updateSettings({ progressionLogMode: e.target.value as TechniqueDisplayMode })}
                    className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
                  >
                    <option value="name-only">Name Only</option>
                    <option value="name-illumination">Name + Illumination</option>
                    <option value="name-illumination-realm">Name + Illumination + Realm</option>
                    <option value="name-illumination-realm-path">Full Treatment</option>
                  </select>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Layout density</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "auto", label: "Auto" }, { value: "compact", label: "Compact" }, { value: "full", label: "Full" }]).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ progressionLogCompact: opt.value as RecentSessionsCompactMode })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionLogCompact ?? "auto") === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Variation text</span>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {([{ value: "abbreviation", label: "Abbrev" }, { value: "full", label: "Full" }] as const).map((opt, idx) => (
                      <button
                        key={opt.value}
                        onClick={() => updateSettings({ progressionVariationDisplay: opt.value as VariationDisplayMode })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
                          (settings.progressionVariationDisplay ?? "abbreviation") === opt.value
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <span className="text-[11px] text-mist-light shrink-0">Column colours (W/R)</span>
                  <button type="button" role="switch" aria-checked={settings.progressionColumnColorsEnabled ?? true} onClick={() => updateSettings({ progressionColumnColorsEnabled: !(settings.progressionColumnColorsEnabled ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.progressionColumnColorsEnabled ?? true) ? "bg-gold" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.progressionColumnColorsEnabled ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <span className="text-[11px] text-mist-light shrink-0 block">Column order</span>
                    <span className="text-[9px] text-mist-dark block mt-0.5">
                      {(settings.progressionColumnOrderGrouped ?? true) ? "W1, W2, W3, R1, R2, R3 (grouped)" : "W1, R1, W2, R2, W3, R3 (paired)"}
                    </span>
                  </div>
                  <button type="button" role="switch" aria-checked={settings.progressionColumnOrderGrouped ?? true} onClick={() => updateSettings({ progressionColumnOrderGrouped: !(settings.progressionColumnOrderGrouped ?? true) })} className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${(settings.progressionColumnOrderGrouped ?? true) ? "bg-gold" : "bg-ink-light"}`}>
                    <span className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${(settings.progressionColumnOrderGrouped ?? true) ? "translate-x-[14px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="py-1.5">
                  <div className="min-w-0 mb-2">
                    <span className="text-[11px] text-mist-light block">Visible columns (unified)</span>
                    <span className="text-[9px] text-mist-dark block mt-0.5">Exercise always stays visible. S = Set value (weight/time)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {UNIFIED_COLUMN_OPTIONS.map((option) => (
                      <label key={option.key} className="flex items-center gap-2 rounded-md border border-ink-light/70 px-2 py-1.5 text-[10px] text-mist-light hover:border-gold/30 hover:bg-ink-mid/15 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={visibleUnifiedColumns.includes(option.key)}
                          onChange={() => toggleUnifiedColumn(option.key)}
                          className="h-3.5 w-3.5 rounded border-ink-light bg-ink-dark text-gold focus:ring-gold/40"
                        />
                        <span className={getColumnOptionLabelClass(option.label)}>{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <span className="text-[11px] text-mist-light shrink-0 block">Default weight unit</span>
                    <span className="text-[9px] text-mist-dark block mt-0.5">Used for display in the unified training log</span>
                  </div>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {(["kg", "lbs"] as const).map((u, idx) => (
                      <button
                        key={u}
                        onClick={() => updateSettings({ defaultWeightUnit: u as WeightUnitPref })}
                        className={`px-3 py-1 text-[10px] font-medium transition-all ${
                          (settings.defaultWeightUnit ?? "kg") === u
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {u.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 py-1.5">
                  <div className="min-w-0">
                    <span className="text-[11px] text-mist-light shrink-0 block">Popup logger style</span>
                    <span className="text-[9px] text-mist-dark block mt-0.5">
                      {(settings.popupLoggerStyle ?? "classic") === "classic" ? "Full set panels with timer integration" : (settings.popupLoggerStyle ?? "classic") === "minimal" ? "Vertical stacked rows — quick entry" : "Compact inline grid — max density"}
                    </span>
                  </div>
                  <div className="flex rounded-md border border-ink-light overflow-hidden">
                    {(["classic", "minimal", "compact"] as const).map((s, idx) => (
                      <button
                        key={s}
                        onClick={() => updateSettings({ popupLoggerStyle: s as PopupLoggerStyle })}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-all capitalize ${
                          (settings.popupLoggerStyle ?? "classic") === s
                            ? "bg-gold-dim/20 text-gold border-gold/30"
                            : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                        } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-mist-light">Glow intensity</span>
                    <span className="text-[10px] text-gold font-medium tabular-nums w-8 text-right">{settings.glowIntensityProgressionLog ?? 100}%</span>
                  </div>
                  <input type="range" min="0" max="100" step="5" value={settings.glowIntensityProgressionLog ?? 100} onChange={(e) => updateSettings({ glowIntensityProgressionLog: parseInt(e.target.value) })} className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-gold" />
                </div>
              </div>
            </div>

          </div>
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 3: PREFERENCES — Date Format
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="blue" hoverable={false}>
          <h3 className="text-sm text-mountain-blue-glow uppercase tracking-wider mb-4">
            Preferences
          </h3>

          {/* Date Format */}
          <div>
            <p className="text-xs text-mist-light font-medium mb-2">Date Format</p>
            <p className="text-xs text-mist-dark mb-3">
              Choose how dates are displayed across the platform
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { value: "dd-mm-yyyy" as DateFormatOption, label: "DD-MM-YYYY", example: "24-02-2026" },
                { value: "dd-mmm-yyyy" as DateFormatOption, label: "DD-MMM-YYYY", example: "24-Feb-2026" },
                { value: "dd-mm-yy" as DateFormatOption, label: "DD-MM-YY", example: "24-02-26" },
                { value: "dd-mmm-yy" as DateFormatOption, label: "DD-MMM-YY", example: "24-Feb-26" },
              ]).map((fmt) => (
                <button
                  key={fmt.value}
                  onClick={() => updateSettings({ dateFormat: fmt.value })}
                  className={`px-2.5 py-2 rounded-md border text-left transition-all ${
                    settings.dateFormat === fmt.value
                      ? "bg-jade-deep/30 border-jade-glow/50 text-jade-glow"
                      : "border-ink-light text-mist-dark hover:text-mist-light hover:border-mist-dark"
                  }`}
                >
                  <div className="text-[11px] font-medium">{fmt.label}</div>
                  <div className="text-[10px] opacity-60 mt-0.5">{fmt.example}</div>
                </button>
              ))}
            </div>
          </div>
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 4: TERMINOLOGY MODE
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="gold" hoverable={false}>
          <h3 className="text-sm text-gold uppercase tracking-wider mb-4">
            Terminology
          </h3>

          <div>
            <p className="text-xs text-mist-light font-medium mb-2">Interface Language Style</p>
            <p className="text-xs text-mist-dark mb-3">
              Switch between wuxia-inspired cultivation terminology and conventional fitness terminology. Difficulty level names are preserved in both modes.
            </p>
            <div className="flex rounded-md border border-ink-light overflow-hidden mb-4">
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
                  <div className="text-[10px] opacity-60">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* Preview of current mode */}
            <div className="p-3 rounded-lg border border-ink-light/30 bg-ink-dark/50">
              <p className="text-[9px] text-mist-dark uppercase tracking-wider mb-2">Current Labels</p>
              <div className="flex flex-wrap gap-1.5">
                {["Dao Hall", "Training Grounds", "Technique Scroll", "Sect Register", "Cultivation Path", "Inner Chamber"].map((label) => (
                  <span key={label} className="text-[10px] px-2 py-1 rounded-md border border-ink-light/30 bg-ink-dark/30 text-mist-light">
                    {t(label, settings.terminologyMode)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </GlowCard>

        {/* ══════════════════════════════════════════════════════════
            SECTION 5: SETUP WIZARD — Re-run
           ══════════════════════════════════════════════════════════ */}
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-4">
            Setup Wizard
          </h3>
          <p className="text-xs text-mist-dark mb-4">
            Re-run the guided setup wizard to reconfigure your display preferences, theme, terminology, and layout options.
          </p>
          <GlowButton
            variant="jade"
            size="sm"
            glow
            className="w-full"
            onClick={() => setShowWizard(true)}
          >
            ✦ Open Setup Wizard
          </GlowButton>
        </GlowCard>

      </div>

      {/* Setup Wizard modal */}
      {showWizard && <SetupWizard onComplete={() => setShowWizard(false)} />}
    </PageLayout>
  );
}
