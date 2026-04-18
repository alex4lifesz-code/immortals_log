"use client";

import Link from "next/link";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { defaultNavItems } from "@/lib/constants";
import { ADMIN_NAV_IDS } from "@/lib/navigation";

const COMPACT_LABELS: Record<string, string> = {
  dashboard: "Home",
  newsfeed: "Feed",
  "rank-up": "Progress",
  history: "Train",
  "training-log-history": "History",
  checkin: "Check-In",
  "exercise-db": "Library",
  friends: "Friends",
  settings: "Settings",
  "website-information": "Website",
  admin: "Admin",
};

export default function DashboardHomePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const navItems = defaultNavItems.filter((item) => item.id !== "dashboard" && (isAdmin || !ADMIN_NAV_IDS.has(item.id)));

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Navigation hub"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="px-0 py-2">
        <section
          className="rounded-xl border p-2.5 sm:p-3"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid))",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 10px 24px rgba(0,0,0,0.2)",
          }}
        >
          <div className="mb-2.5 border-b pb-2" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea1ff]">Training Canvas</p>
            <h2 className="mt-1 text-[15px] font-semibold text-[#f2f3f5]">Navigation Grid</h2>
          </div>

          <div className="grid grid-cols-4 gap-2 content-start sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
            {navItems.map((item) => {
              const isCurrent = item.id === "dashboard";
              return (
                <Link key={item.id} href={item.path} className="group block">
                  <div
                    className="flex aspect-square min-h-[68px] flex-col items-center justify-between rounded-xl border px-1 py-1.5 text-center transition-all duration-150 active:scale-[0.98]"
                    style={{
                      borderColor: isCurrent
                        ? "rgba(88, 101, 242, 0.46)"
                        : "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                      backgroundColor: isCurrent
                        ? "color-mix(in srgb, var(--accent) 14%, var(--ink-mid))"
                        : "color-mix(in srgb, var(--ink-mid) 52%, var(--ink-deep))",
                      boxShadow: isCurrent
                        ? "inset 0 0 0 1px rgba(88,101,242,0.14), 0 8px 18px rgba(0,0,0,0.16)"
                        : "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[17px] leading-none sm:h-10 sm:w-10 sm:text-[20px]"
                      style={{
                        backgroundColor: isCurrent
                          ? "color-mix(in srgb, var(--accent) 18%, transparent)"
                          : "color-mix(in srgb, var(--ink-light) 10%, transparent)",
                        boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 4%, transparent)",
                      }}
                    >
                      {item.icon}
                    </span>

                    <div className="space-y-0.5">
                      <span className="line-clamp-2 block text-[10px] font-semibold leading-tight text-[#f2f3f5] sm:text-[11px]">
                        {COMPACT_LABELS[item.id] ?? item.label}
                      </span>
                      <span className="block text-[9px] text-[#949ba4]">
                        {isCurrent ? "Current" : "Open"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
