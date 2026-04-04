"use client";

import { useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import {
  useDisplaySettings,
  DateFormatOption,
  VariationDisplayMode,
  WeightUnitPref,
} from "@/context/DisplaySettingsContext";
import type { Theme } from "@/lib/config";

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

function PanelTitle({ text }: { text: string }) {
  return (
    <div
      className="px-3 py-2 border-b"
      style={{
        borderColor: "var(--nyaa-table-grid)",
        backgroundColor: "var(--nyaa-table-head-bg)",
      }}
    >
      <p className="text-xs font-bold" style={{ color: "var(--nyaa-table-head-text)" }}>
        {text}
      </p>
    </div>
  );
}

function OptionButton({
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
      className="w-full text-left border px-2.5 py-2 transition-colors"
      style={{
        borderColor: active ? "var(--accent)" : "var(--border)",
        backgroundColor: active
          ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
          : "var(--surface)",
        color: active ? "var(--accent)" : "var(--text-primary)",
      }}
    >
      <p className="text-[11px] font-semibold">{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-[10px]" style={{ color: "var(--text-secondary)" }}>
          {subtitle}
        </p>
      ) : null}
    </button>
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

  return (
    <PageLayout
      title="Settings"
      subtitle="Configure your training interface"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <PanelTitle text="Settings Summary" />
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "30%" }}>
                  User:
                </td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {user?.name || "Unknown"}
                </td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "20%" }}>
                  Theme:
                </td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>
                  {themeLabel}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  Date Format:
                </td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {settings.dateFormat}
                </td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  Terminology:
                </td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {settings.terminologyMode === "fantasy" ? "Cultivation" : "Conventional"}
                </td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  Weight Unit:
                </td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                  {settings.defaultWeightUnit}
                </td>
                <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>
                  Variation Labels:
                </td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                  {settings.progressionVariationDisplay}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <PanelTitle text="Theme" />
          <div className="grid gap-1.5 p-2 sm:grid-cols-2 lg:grid-cols-3" style={{ backgroundColor: "var(--surface)" }}>
            {THEME_OPTIONS.map((theme) => (
              <OptionButton
                key={theme.value}
                active={themeStyle === theme.value}
                title={theme.label}
                subtitle={theme.desc}
                onClick={() => setThemeStyle(theme.value)}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
            <PanelTitle text="Date Format" />
            <div className="grid gap-1.5 p-2" style={{ backgroundColor: "var(--surface)" }}>
              {DATE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={settings.dateFormat === option.value}
                  title={option.label}
                  subtitle={option.sample}
                  onClick={() => updateSettings({ dateFormat: option.value })}
                />
              ))}
            </div>
          </div>

          <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
            <PanelTitle text="Terminology" />
            <div className="grid gap-1.5 p-2" style={{ backgroundColor: "var(--surface)" }}>
              <OptionButton
                active={settings.terminologyMode === "fantasy"}
                title="Cultivation"
                subtitle="Wuxia-themed labels"
                onClick={() => updateSettings({ terminologyMode: "fantasy" })}
              />
              <OptionButton
                active={settings.terminologyMode === "normal"}
                title="Conventional"
                subtitle="Standard fitness labels"
                onClick={() => updateSettings({ terminologyMode: "normal" })}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 lg:grid-cols-2">
          <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
            <PanelTitle text="Weight Unit" />
            <div className="grid gap-1.5 p-2" style={{ backgroundColor: "var(--surface)" }}>
              {([
                { value: "kg" as WeightUnitPref, title: "Kilograms (kg)" },
                { value: "lbs" as WeightUnitPref, title: "Pounds (lbs)" },
              ]).map((option) => (
                <OptionButton
                  key={option.value}
                  active={settings.defaultWeightUnit === option.value}
                  title={option.title}
                  onClick={() => updateSettings({ defaultWeightUnit: option.value })}
                />
              ))}
            </div>
          </div>

          <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
            <PanelTitle text="Variation Labels" />
            <div className="grid gap-1.5 p-2" style={{ backgroundColor: "var(--surface)" }}>
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
                />
              ))}
            </div>
          </div>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <PanelTitle text="Actions" />
          <div className="grid gap-1.5 p-2 sm:grid-cols-2" style={{ backgroundColor: "var(--surface)" }}>
            <button
              type="button"
              onClick={resetSettings}
              className="w-full border px-3 py-2 text-[11px] font-semibold transition-colors"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "color-mix(in srgb, var(--surface) 90%, var(--border))",
                color: "var(--text-primary)",
              }}
            >
              Reset Display Settings
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-full border px-3 py-2 text-[11px] font-semibold transition-colors"
              style={{
                borderColor: "var(--danger)",
                backgroundColor: "color-mix(in srgb, var(--danger) 8%, var(--surface))",
                color: "var(--danger)",
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
