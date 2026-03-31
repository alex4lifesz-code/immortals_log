"use client";

import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  DateFormatOption,
  WeightUnitPref,
  VariationDisplayMode,
} from "@/context/DisplaySettingsContext";
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

function SettingsSidebar({ onLogout }: { onLogout: () => void }) {
  const { themeStyle } = useAppContext();
  const { settings } = useDisplaySettings();

  const themeLabels: Record<string, string> = {
    "midnight-ink": "Midnight Ink",
    "mountain-mist": "Mountain Mist",
    "calligraphy": "Calligraphy",
    "sakura": "Sakura",
    "sakura-dark": "Sakura Dark",
    "eternal": "Eternal",
    "discord": "Discord",
    "document": "Document",
    "nyaa": "Nyaa",
  };

  const dateLabels: Record<string, string> = {
    "dd-mm-yyyy": "DD-MM-YYYY",
    "dd-mmm-yyyy": "DD-MMM-YYYY",
    "dd-mm-yy": "DD-MM-YY",
    "dd-mmm-yy": "DD-MMM-YY",
  };

  return (
    <div className="dashboard-sidebar-shell">
      <div className="dashboard-sidebar-scroll sidebar-scroll space-y-3">
      <div className="dashboard-sidebar-card">
        <h3 className="text-[10px] text-gold uppercase tracking-wider mb-2 font-semibold">Appearance</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Theme" value={themeLabels[themeStyle] || themeStyle} color="text-gold" />
        </div>
      </div>

      <div className="dashboard-sidebar-card">
        <h3 className="text-[10px] text-mountain-blue-glow uppercase tracking-wider mb-2 font-semibold">Settings</h3>
        <div className="divide-y divide-ink-light/20">
          <SettingRow label="Date Format" value={dateLabels[settings.dateFormat] || settings.dateFormat} color="text-mountain-blue-glow" />
          <SettingRow label="Terminology" value={settings.terminologyMode === "fantasy" ? "Cultivation" : "Conventional"} color="text-mountain-blue-glow" />
          <SettingRow label="Weight Unit" value={settings.defaultWeightUnit === "kg" ? "Kilograms (kg)" : "Pounds (lbs)"} color="text-mountain-blue-glow" />
          <SettingRow label="Variation Labels" value={settings.progressionVariationDisplay === "abbreviation" ? "Abbreviated" : "Full Text"} color="text-mountain-blue-glow" />
        </div>
      </div>

      <div className="dashboard-sidebar-card">
        <h3 className="text-[10px] text-crimson-glow uppercase tracking-wider mb-2 font-semibold">Quick Actions</h3>
        <div className="space-y-1.5">
          <GlowButton
            variant="crimson"
            size="sm"
            className="w-full !text-[10px]"
            onClick={onLogout}
          >
            Logout
          </GlowButton>
        </div>
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
  } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();

  return (
    <PageLayout
      title="Inner Chamber"
      subtitle="Configure your cultivation environment"
      sidebar={<SettingsSidebar onLogout={logout} />}
    >
      <div className="space-y-6 max-w-2xl">

        {/* Appearance */}
        <GlowCard glow="gold" hoverable={false}>
          <h3 className="text-sm text-gold uppercase tracking-wider mb-4">
            Appearance
          </h3>

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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-midnight-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-midnight-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-midnight-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-midnight-4)" }} />
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-mountain-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-mountain-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-mountain-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-mountain-4)" }} />
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-calligraphy-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-calligraphy-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-calligraphy-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-calligraphy-4)" }} />
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-4)" }} />
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
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-dark-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-dark-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-dark-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-sakura-dark-4)" }} />
              </div>
              <p className="text-xs font-medium text-cloud-white">Sakura Dark</p>
              <p className="text-[10px] text-mist-dark">Deep sakura &amp; rose</p>
            </motion.button>
          </div>

          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("eternal")}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "eternal"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-eternal-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-eternal-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-eternal-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-eternal-4)" }} />
              </div>
              <p className="text-xs font-medium text-cloud-white">Eternal</p>
              <p className="text-[10px] text-mist-dark">Clean minimalist &amp; nature</p>
            </motion.button>
          </div>

          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("discord")}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "discord"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-discord-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-discord-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-discord-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-discord-4)" }} />
              </div>
              <p className="text-xs font-medium text-cloud-white">Discord</p>
              <p className="text-[10px] text-mist-dark">Discord-inspired dark palette</p>
            </motion.button>
          </div>

          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("document")}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "document"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-document-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-document-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-document-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-document-4)" }} />
              </div>
              <p className="text-xs font-medium text-cloud-white">Document</p>
              <p className="text-[10px] text-mist-dark">Warm parchment &amp; slate blue</p>
            </motion.button>
          </div>

          <div className="mb-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setThemeStyle("nyaa")}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-300 ${
                themeStyle === "nyaa"
                  ? "border-jade/50 bg-jade-deep/20 glow-subtle"
                  : "border-ink-light bg-ink-dark/50 hover:border-mist-mid"
              }`}
            >
              <div className="flex gap-1 mb-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-nyaa-1)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-nyaa-2)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-nyaa-3)" }} />
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: "var(--theme-preview-nyaa-4)" }} />
              </div>
              <p className="text-xs font-medium text-cloud-white">Nyaa</p>
              <p className="text-[10px] text-mist-dark">Nyaa.si-inspired blue/green palette</p>
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

        {/* Preferences — Date Format */}
        <GlowCard glow="blue" hoverable={false}>
          <h3 className="text-sm text-mountain-blue-glow uppercase tracking-wider mb-4">
            Preferences
          </h3>

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

        {/* Terminology Mode */}
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
                { value: "fantasy" as const, label: "Cultivation", desc: "Wuxia-themed terms" },
                { value: "normal" as const, label: "Conventional", desc: "Standard fitness terms" },
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

        {/* Weight Unit */}
        <GlowCard glow="gold" hoverable={false}>
          <h3 className="text-sm text-gold uppercase tracking-wider mb-4">
            Weight Unit
          </h3>
          <div>
            <p className="text-xs text-mist-light font-medium mb-2">Default Weight Display</p>
            <p className="text-xs text-mist-dark mb-3">
              Choose which unit is shown by default when logging weights and viewing training history.
            </p>
            <div className="flex rounded-md border border-ink-light overflow-hidden">
              {([
                { value: "kg" as WeightUnitPref, label: "Kilograms", desc: "kg" },
                { value: "lbs" as WeightUnitPref, label: "Pounds", desc: "lbs" },
              ]).map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ defaultWeightUnit: opt.value })}
                  className={`flex-1 px-3 py-2.5 text-center transition-all ${
                    settings.defaultWeightUnit === opt.value
                      ? "bg-jade-deep/30 text-jade-glow"
                      : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                  } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                >
                  <div className="text-[11px] font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-60">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </GlowCard>

        {/* Variation Display */}
        <GlowCard glow="blue" hoverable={false}>
          <h3 className="text-sm text-mountain-blue-glow uppercase tracking-wider mb-4">
            Variation Labels
          </h3>
          <div>
            <p className="text-xs text-mist-light font-medium mb-2">Exercise Variation Display</p>
            <p className="text-xs text-mist-dark mb-3">
              Controls how variation names appear in the training log table.
            </p>
            <div className="flex rounded-md border border-ink-light overflow-hidden">
              {([
                { value: "abbreviation" as VariationDisplayMode, label: "Abbreviated", desc: "e.g. SB, 1.5x, BW" },
                { value: "full" as VariationDisplayMode, label: "Full Text", desc: "e.g. Supinated Band" },
              ]).map((opt, idx) => (
                <button
                  key={opt.value}
                  onClick={() => updateSettings({ progressionVariationDisplay: opt.value })}
                  className={`flex-1 px-3 py-2.5 text-center transition-all ${
                    settings.progressionVariationDisplay === opt.value
                      ? "bg-jade-deep/30 text-jade-glow"
                      : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
                  } ${idx > 0 ? "border-l border-ink-light" : ""}`}
                >
                  <div className="text-[11px] font-medium">{opt.label}</div>
                  <div className="text-[10px] opacity-60">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </GlowCard>

      </div>
    </PageLayout>
  );
}