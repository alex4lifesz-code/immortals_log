"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

const tabs = [
  { href: "/dashboard/mobile", label: "Home", icon: "\u2302" },
  { href: "/dashboard/mobile/training", label: "Training", icon: "\u2694" },
  { href: "/dashboard/mobile/check-in", label: "Check-In", icon: "\u270e" },
  { href: "/dashboard/mobile/progress", label: "Progress", icon: "\u25c9" },
  { href: "/dashboard/mobile/profile/settings/theme", label: "Theme", icon: "\u25e8" },
] as const;

export default function MobileBottomNav() {
  const pathname = usePathname();
  const haptics = useHapticFeedback();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-ink-deep/95 pb-[max(env(safe-area-inset-bottom,0px),8px)] pt-2 backdrop-blur-sm">
      <ul className="mx-auto grid max-w-xl grid-cols-5 gap-1 px-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                onClick={() => haptics.light()}
                className={`flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 py-1 text-[11px] ${
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
