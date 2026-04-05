"use client";

import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileThemeSelector from "@/components/mobile/theme/MobileThemeSelector";

export default function MobileThemeSettingsPage() {
  return (
    <div>
      <MobileHeader title="Theme Styles" />
      <section className="mobile-content-stack space-y-4 p-4">
        <MobileCard>
          <h2 className="text-base font-semibold text-cloud-white">Choose Theme</h2>
          <p className="mt-1 text-sm text-mist-light">Reuses shared theme preference and sync logic from AppContext.</p>
          <div className="mt-4">
            <MobileThemeSelector />
          </div>
        </MobileCard>
      </section>
    </div>
  );
}
