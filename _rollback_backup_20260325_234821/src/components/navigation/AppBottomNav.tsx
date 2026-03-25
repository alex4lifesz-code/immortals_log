"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/home", label: "Home", icon: "H" },
  { href: "/train", label: "Train", icon: "T" },
  { href: "/progress", label: "Progress", icon: "P" },
  { href: "/library", label: "Library", icon: "L" },
  { href: "/profile", label: "Profile", icon: "U" },
];

export default function AppBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gold-dim/40 bg-void-black/95 backdrop-blur-md">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-2 text-[10px] transition-colors ${
                active ? "text-gold-glow" : "text-mist-light hover:text-cloud-white"
              }`}
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="mt-1 uppercase tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
