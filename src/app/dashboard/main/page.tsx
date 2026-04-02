"use client";

import Link from "next/link";
import { useSortedNavItems } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { t } from "@/lib/terminology";
import { ADMIN_NAV_IDS, ADMIN_NAV_IDS_ORDER, MAIN_NAV_IDS_ORDER, NAV_LABELS, sortNavItemsByIdOrder } from "@/lib/navigation";

export default function MainNavigationPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const isAdmin = user?.role === "admin";

  const items = useSortedNavItems();
  const mainItems = sortNavItemsByIdOrder(items.filter((item) => !ADMIN_NAV_IDS.has(item.id)), MAIN_NAV_IDS_ORDER);
  const adminItems = isAdmin
    ? sortNavItemsByIdOrder(items.filter((item) => ADMIN_NAV_IDS.has(item.id)), ADMIN_NAV_IDS_ORDER)
    : [];

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 sm:px-5 sm:py-4">
          <h1 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">{NAV_LABELS.main}</h1>
          <p className="mt-1 text-xs text-text-secondary sm:text-sm">
            Quick access to all navigation destinations.
          </p>
        </div>

        <section aria-label="Standard navigation">
          <h2 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-secondary sm:text-xs">
            Standard
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {mainItems.map((item) => (
              <Link
                key={item.id}
                href={item.path}
                className="group flex h-24 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 transition-colors hover:border-accent/40 hover:bg-surface-hover sm:h-20"
              >
                <span className="text-xl leading-none text-text-secondary transition-colors group-hover:text-text-primary" aria-hidden="true">{item.icon}</span>
                <div className="min-w-0">
                  <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-primary sm:text-xs">
                    {t(item.label, terminologyMode)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {isAdmin && adminItems.length > 0 && (
          <section aria-label="Admin navigation" className="mt-4">
            <h2 className="mb-2 px-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent sm:text-xs">
              Admin
            </h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {adminItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.path}
                  className="group flex h-24 items-center gap-3 rounded-xl border border-accent/30 bg-surface px-3 py-2.5 transition-colors hover:border-accent/50 hover:bg-surface-hover sm:h-20"
                >
                  <span className="text-xl leading-none text-text-secondary transition-colors group-hover:text-text-primary" aria-hidden="true">{item.icon}</span>
                  <div className="min-w-0">
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-text-primary sm:text-xs">
                      {t(item.label, terminologyMode)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
