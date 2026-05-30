"use client";

import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileThemeSelector from "@/components/mobile/theme/MobileThemeSelector";
import { useAppContext } from "@/context/AppContext";

export default function MobileThemeSettingsPage() {
  const { themeMode, setThemeMode } = useAppContext();

  return (
    <div>
      <MobileHeader title="Canvas Theme" />
      <section className="mobile-content-stack space-y-4 p-3 pb-24">
        <div
          className="overflow-hidden rounded-xl border p-4 shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 90%, var(--accent) 10%)",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>Mobile view</p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Canvas themes</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Choose your theme style and appearance mode for the full app.
          </p>
        </div>

        <MobileCard
          className="rounded-xl border shadow-none"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 90%, var(--accent) 10%)",
            background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
          }}
        >
          <h2 className="mb-1 text-sm uppercase tracking-wider" style={{ color: "var(--accent)" }}>Theme</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Select the visual style for your training canvas.</p>
          <div className="mt-4">
            <MobileThemeSelector />
          </div>
        </MobileCard>

        <MobileCard
          className="rounded-xl border shadow-none"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 90%, var(--accent) 10%)",
            background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
          }}
        >
          <h2 className="mb-1 text-sm uppercase tracking-wider" style={{ color: "var(--accent)" }}>Appearance</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Switch between Light, Dark, or System (follow device settings).</p>
          <div className="mt-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme appearance">
            {(["light", "dark", "auto"] as const).map((mode) => {
              const active = themeMode === mode;
              const disabled = mode === "light" || mode === "auto";
              const label = mode === "light" ? "Light" : mode === "dark" ? "Dark" : "System";
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={disabled}
                  onClick={() => !disabled && setThemeMode(mode)}
                  className="rounded-lg border px-3 py-2 text-center transition"
                  style={{
                    borderColor: disabled ? "var(--border)" : active ? "var(--accent)" : "var(--border)",
                    backgroundColor: disabled ? "color-mix(in srgb, var(--surface) 60%, transparent)" : active ? "color-mix(in srgb, var(--accent) 16%, var(--surface))" : "var(--surface)",
                    color: "var(--text-muted)",
                    boxShadow: active && !disabled ? "var(--glow-subtle)" : "none",
                    opacity: disabled ? 0.45 : 1,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  <div className="text-sm font-semibold" style={{ color: disabled ? "var(--text-muted)" : active ? "var(--text-primary)" : "var(--text-secondary)" }}>
                    {label}
                  </div>
                </button>
              );
            })}
          </div>
        </MobileCard>
      </section>
    </div>
  );
}
