"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { MOBILE_BOTTOM_TABS } from "@/lib/navigation";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const haptics = useHapticFeedback();

  return (
    <nav className="mobile-bottom-nav-polish fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-ink-deep/95 pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-2 backdrop-blur-sm">
      <ul className="mx-auto grid max-w-xl gap-1 px-2" style={{ gridTemplateColumns: `repeat(${MOBILE_BOTTOM_TABS.length}, minmax(0, 1fr))` }}>
        {MOBILE_BOTTOM_TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => haptics.light()}
                aria-current={active ? "page" : undefined}
                className={`mobile-tab-polish ${active ? "is-active" : ""} flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 py-1 text-[11px] ${
                  active
                    ? "border-jade-glow bg-jade-deep/30 text-jade-light"
                    : "border-transparent text-mist-light"
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="mt-1 truncate">{tab.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
