"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { MOBILE_BOTTOM_TABS } from "@/lib/navigation";

export default function MobileBottomNav() {
  const pathname = usePathname();
  const haptics = useHapticFeedback();

  return (
    <nav
      data-mobile-bottom-nav="true"
      className="fixed bottom-0 left-0 right-0 z-50 pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-2 pl-[max(env(safe-area-inset-left,0px),8px)] pr-[max(env(safe-area-inset-right,0px),8px)]"
    >
      <div
        className="mobile-bottom-nav-polish relative mx-auto max-w-xl overflow-hidden rounded-2xl border px-2 pb-1.5 pt-1"
        style={{
          borderColor: "color-mix(in srgb, var(--ink-light) 72%, var(--border))",
          background: "linear-gradient(180deg, color-mix(in srgb, var(--ink-deep) 88%, var(--surface-hover)) 0%, color-mix(in srgb, var(--surface) 96%, black) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 24%, var(--ink-light)) 20%, color-mix(in srgb, var(--ink-light) 88%, var(--border)) 50%, color-mix(in srgb, var(--accent) 24%, var(--ink-light)) 80%, transparent 100%)",
          }}
        />
        <ul className="grid gap-1" style={{ gridTemplateColumns: `repeat(${MOBILE_BOTTOM_TABS.length}, minmax(0, 1fr))` }}>
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
      </div>
    </nav>
  );
}
