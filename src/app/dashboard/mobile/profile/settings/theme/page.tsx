"use client";

import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileThemeSelector from "@/components/mobile/theme/MobileThemeSelector";

export default function MobileThemeSettingsPage() {
  return (
    <div>
      <MobileHeader title="Theme Styles" />
      <section className="mobile-content-stack space-y-4 p-3 pb-24">
        <div
          className="overflow-hidden rounded-xl border p-4 shadow-[0_8px_18px_rgba(0,0,0,0.18)]"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 90%, var(--accent) 10%)",
            background: "linear-gradient(145deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em]" style={{ color: "var(--accent)" }}>Mobile view</p>
          <h2 className="mt-2 text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Discord-style theme picker</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            Built for phones first with larger tap targets, cleaner spacing, and the darker Discord palette from the live app.
          </p>
        </div>

        <MobileCard
          className="rounded-xl border shadow-none"
          style={{
            borderColor: "color-mix(in srgb, var(--border) 90%, var(--accent) 10%)",
            background: "linear-gradient(160deg, color-mix(in srgb, var(--surface) 98%, transparent), color-mix(in srgb, var(--surface-hover) 88%, transparent))",
          }}
        >
          <h2 className="mb-1 text-sm uppercase tracking-wider" style={{ color: "var(--accent)" }}>Choose Theme</h2>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Your selection updates the full app experience instantly.</p>
          <div className="mt-4">
            <MobileThemeSelector />
          </div>
        </MobileCard>
      </section>
    </div>
  );
}
