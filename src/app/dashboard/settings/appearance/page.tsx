"use client";

import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAppContext } from "@/context/AppContext";
import type { Theme } from "@/lib/config";
import {
  SectionCard,
  SettingsSelectField,
  THEME_OPTIONS,
  fieldShellStyle,
} from "../_shared";

export default function AppearanceSettingsPage() {
  const { themeStyle, setThemeStyle, themeMode, setThemeMode } = useAppContext();
  const selectedTheme = THEME_OPTIONS.find((theme) => theme.value === themeStyle);

  return (
    <PageLayout
      title="Appearance"
      subtitle="Theme and color mode"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:space-y-4 sm:py-3">
        <Link
          href="/dashboard/settings"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: "var(--accent)" }}
        >
          <span aria-hidden="true">←</span> Back to Settings
        </Link>

        <SectionCard eyebrow="Appearance" title="Theme" description="Discord is now the single fixed app canvas." badge="Visual">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <SettingsSelectField
              label="Theme style"
              value={themeStyle}
              onChange={(value) => setThemeStyle(value as Theme)}
              options={THEME_OPTIONS.map((theme) => ({ value: theme.value, label: theme.label, desc: theme.desc }))}
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
      </div>
    </PageLayout>
  );
}
