"use client";

import Link from "next/link";
import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileCollapsibleSection from "@/components/mobile/layout/MobileCollapsibleSection";

export default function MobileProfilePage() {
  return (
    <div>
      <MobileHeader title="Profile & Settings" />
      <section className="mobile-content-stack space-y-6 p-4">
        <MobileCard>
          <h2 className="text-sm text-jade-glow uppercase tracking-wider mb-1">Preferences</h2>
          <p className="mt-1 text-sm text-mist-light">Theme, handedness, and behaviour settings optimised for one-handed use.</p>
          <Link href="/dashboard/mobile/profile/settings/theme" className="mt-3 inline-flex min-h-12 items-center rounded-xl border border-ink-light bg-ink-dark px-4 text-sm text-cloud-white">
            Open Theme Selector
          </Link>
        </MobileCard>

        <MobileCollapsibleSection title="Data & Backup">
          <p className="text-sm text-mist-light">Use existing admin export/import flows for logs and check-ins.</p>
        </MobileCollapsibleSection>
      </section>
    </div>
  );
}
