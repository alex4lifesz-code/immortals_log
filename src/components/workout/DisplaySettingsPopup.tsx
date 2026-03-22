"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useDisplaySettings, TechniqueDisplayMode, RecentSessionsCompactMode, ActiveCardStyle } from "@/context/DisplaySettingsContext";
import PresetSlots from "@/components/ui/PresetSlots";

/* ──────────────────────────── Option Definitions ──────────────────────────── */

const DISPLAY_MODE_OPTIONS: { value: TechniqueDisplayMode; label: string }[] = [
  { value: "name-only", label: "Name Only" },
  { value: "name-illumination", label: "Name + Illumination" },
  { value: "name-illumination-realm", label: "Name + Illumination + Realm" },
  { value: "name-illumination-realm-path", label: "Full Treatment" },
];

/* ──────────────────────────── Sub-Components ──────────────────────────── */

function SectionHeader({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm">{icon}</span>
      <h4 className="text-[11px] font-semibold text-jade-glow uppercase tracking-wider">{label}</h4>
      <div className="flex-1 h-px bg-ink-light/30" />
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-[11px] text-mist-light shrink-0">{label}</span>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-ink-dark border border-ink-light rounded-md px-2 py-1 text-[11px] text-cloud-white cursor-pointer hover:border-jade/40 focus:border-jade-glow/60 focus:outline-none transition-colors appearance-none pr-6"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 6px center",
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function SegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex rounded-md border border-ink-light overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2.5 py-1 text-[10px] font-medium transition-all ${
            value === opt.value
              ? "bg-jade-deep/30 text-jade-glow border-jade-glow/30"
              : "text-mist-dark hover:text-mist-light hover:bg-ink-mid/20"
          } ${opt.value !== options[0].value ? "border-l border-ink-light" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${
        checked ? "bg-jade-glow" : "bg-ink-light"
      }`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-cloud-white shadow transition-transform ${
          checked ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function GlowSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="py-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] text-mist-light">{label}</span>
        <span className="text-[10px] text-jade-glow font-medium tabular-nums w-8 text-right">{value}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-ink-light rounded-full appearance-none cursor-pointer accent-jade-glow"
      />
    </div>
  );
}

/* ──────────────────────────── Modal Content ──────────────────────────── */

function DisplaySettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useDisplaySettings();

  // Escape key dismissal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ isolation: "isolate" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        style={{ backdropFilter: "blur(2px)" }}
        onClick={onClose}
      />

      {/* Modal card */}
      <div
        className="relative w-full max-w-[640px] mx-4 bg-ink-deep border border-ink-light rounded-xl overflow-hidden"
        style={{
          boxShadow: "0 0 40px rgba(45, 95, 79, 0.2), 0 20px 50px rgba(0, 0, 0, 0.5)",
          maxHeight: "min(90vh, 760px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-ink-light bg-ink-deep">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-jade-glow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h3 className="text-sm font-semibold text-jade-glow uppercase tracking-wider">
              Display Settings
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-mist-dark hover:text-crimson-light hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto p-5" style={{ maxHeight: "min(74vh, 640px)" }}>
          {/* Preset Slots */}
          <div className="mb-5">
            <PresetSlots variant="compact" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">

            {/* ═══════════ Left Column ═══════════ */}
            <div className="space-y-5">

              {/* ── Technique Display Modes ── */}
              <div>
                <SectionHeader icon="🎨" label="Technique Display" />
                <div className="space-y-2.5 pl-1">
                  <SettingRow label="Active Cards">
                    <Dropdown
                      value={settings.activeCardMode}
                      options={DISPLAY_MODE_OPTIONS}
                      onChange={(v) => updateSettings({ activeCardMode: v as TechniqueDisplayMode })}
                    />
                  </SettingRow>
                  <SettingRow label="Recent Sessions">
                    <Dropdown
                      value={settings.recentSessionsMode}
                      options={DISPLAY_MODE_OPTIONS}
                      onChange={(v) => updateSettings({ recentSessionsMode: v as TechniqueDisplayMode })}
                    />
                  </SettingRow>
                  <SettingRow label="Sidebar">
                    <Dropdown
                      value={settings.sidebarMode}
                      options={DISPLAY_MODE_OPTIONS}
                      onChange={(v) => updateSettings({ sidebarMode: v as TechniqueDisplayMode })}
                    />
                  </SettingRow>
                </div>
              </div>

              {/* ── Visual Style ── */}
              <div>
                <SectionHeader icon="✨" label="Visual Style" />
                <div className="space-y-2.5 pl-1">
                  <SettingRow label="Active Card Style">
                    <SegmentedControl
                      value={settings.activeCardStyle}
                      options={[
                        { value: "default", label: "Default" },
                        { value: "scroll-card", label: "Scroll" },
                      ]}
                      onChange={(v) => updateSettings({ activeCardStyle: v as ActiveCardStyle })}
                    />
                  </SettingRow>
                  <SettingRow label="Sidebar Style">
                    <SegmentedControl
                      value={settings.sidebarStyle}
                      options={[
                        { value: "default", label: "Default" },
                        { value: "scroll-card", label: "Scroll" },
                      ]}
                      onChange={(v) => updateSettings({ sidebarStyle: v as ActiveCardStyle })}
                    />
                  </SettingRow>
                  <SettingRow label="Sessions Layout">
                    <SegmentedControl
                      value={settings.recentSessionsCompact}
                      options={[
                        { value: "auto", label: "Auto" },
                        { value: "compact", label: "Compact" },
                        { value: "full", label: "Full" },
                      ]}
                      onChange={(v) => updateSettings({ recentSessionsCompact: v as RecentSessionsCompactMode })}
                    />
                  </SettingRow>
                </div>
              </div>

              {/* ── Content & Toggles ── */}
              <div>
                <SectionHeader icon="📜" label="Content & Details" />
                <div className="space-y-1.5 pl-1">
                  <SettingRow label="Compact cards">
                    <Toggle checked={settings.activeCardCompact} onChange={(v) => updateSettings({ activeCardCompact: v })} />
                  </SettingRow>
                  <SettingRow label="Always show notes">
                    <Toggle checked={settings.activeCardNotesAlwaysVisible} onChange={(v) => updateSettings({ activeCardNotesAlwaysVisible: v })} />
                  </SettingRow>
                  <SettingRow label="Card lore text">
                    <Toggle checked={settings.activeCardLoreVisible ?? true} onChange={(v) => updateSettings({ activeCardLoreVisible: v })} />
                  </SettingRow>
                  <SettingRow label="Sidebar lore text">
                    <Toggle checked={settings.sidebarLoreVisible ?? true} onChange={(v) => updateSettings({ sidebarLoreVisible: v })} />
                  </SettingRow>
                </div>
              </div>
            </div>

            {/* ═══════════ Right Column ═══════════ */}
            <div className="space-y-5">

              {/* ── Illumination ── */}
              <div>
                <SectionHeader icon="💡" label="Illumination" />
                <div className="space-y-1 pl-1">
                  <GlowSlider
                    label="Active Cards"
                    value={settings.glowIntensityActiveCards ?? 100}
                    onChange={(v) => updateSettings({ glowIntensityActiveCards: v })}
                  />
                  <GlowSlider
                    label="Recent Sessions"
                    value={settings.glowIntensityRecentSessions ?? 100}
                    onChange={(v) => updateSettings({ glowIntensityRecentSessions: v })}
                  />
                  <GlowSlider
                    label="Sidebar"
                    value={settings.glowIntensitySidebar ?? 100}
                    onChange={(v) => updateSettings({ glowIntensitySidebar: v })}
                  />
                  <div className="flex justify-between text-[9px] text-mist-dark pt-0.5 px-0.5">
                    <span>None</span>
                    <span>Subtle</span>
                    <span>Full</span>
                  </div>
                </div>
              </div>

              {/* ── Layout ── */}
              <div>
                <SectionHeader icon="📐" label="Layout" />
                <div className="space-y-2.5 pl-1">
                  <SettingRow label="Panel Position">
                    <SegmentedControl
                      value={settings.sidebarPosition}
                      options={[
                        { value: "left", label: "◧ Left" },
                        { value: "right", label: "◨ Right" },
                      ]}
                      onChange={(v) => updateSettings({ sidebarPosition: v as "left" | "right" })}
                    />
                  </SettingRow>
                  <SettingRow label="Quick View panel">
                    <Toggle checked={settings.rightPanelVisible} onChange={(v) => updateSettings({ rightPanelVisible: v })} />
                  </SettingRow>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-ink-light bg-ink-dark/40">
          <button
            onClick={resetSettings}
            className="w-full text-xs text-mist-dark hover:text-mist-light py-2 rounded-lg border border-ink-light hover:border-mist-dark transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Exported Component ──────────────────────────── */

export default function DisplaySettingsPopup() {
  const [isOpen, setIsOpen] = useState(false);

  const handleClose = useCallback(() => setIsOpen(false), []);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-jade-glow/40 bg-jade-deep/20 text-jade-glow hover:bg-jade-deep/40 hover:border-jade-glow/60 hover:shadow-[0_0_12px_rgba(58,143,143,0.25)] transition-all duration-200"
        title="Display Settings"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider hidden sm:inline">Display</span>
      </button>

      {isOpen && createPortal(
        <DisplaySettingsModal onClose={handleClose} />,
        document.body
      )}
    </>
  );
}
