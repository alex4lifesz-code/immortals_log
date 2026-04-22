"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import {
  extractLatestWeightPayload,
  loadUserPhysique,
  saveUserPhysique,
} from "@/lib/user-physique";

type ProfileCheckin = {
  userId?: string;
  weight?: number | string | null;
  date?: string | null;
  present?: boolean | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [latestCheckinWeight, setLatestCheckinWeight] = useState<{ weight: number; date: string | null } | null>(null);
  const [weightTrendLabel, setWeightTrendLabel] = useState<string | null>(null);
  const [checkInTotalCount, setCheckInTotalCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    fetch("/api/checkins/latest-weight", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;

        const latest = extractLatestWeightPayload(data);
        if (latest.weight != null) {
          setLatestCheckinWeight({ weight: latest.weight, date: latest.date });
          // Always sync the user's body weight to the most recent check-in weight
          // so other parts of the app (training calculators, etc.) see the latest value.
          const current = loadUserPhysique(user.id);
          if (current.bodyWeightKg !== latest.weight || current.syncWeightFromCheckins !== true) {
            saveUserPhysique(user.id, {
              ...current,
              bodyWeightKg: latest.weight,
              syncWeightFromCheckins: true,
            });
          }
        } else {
          setLatestCheckinWeight(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLatestCheckinWeight(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setWeightTrendLabel(null);
      setCheckInTotalCount(null);
      return;
    }

    let cancelled = false;

    api.get<{ checkins: ProfileCheckin[] }>("/api/checkins", { cache: "no-store" })
      .then((payload) => {
        if (cancelled) return;

        const rawCheckins: ProfileCheckin[] = Array.isArray(payload?.checkins) ? payload.checkins : [];
        const userCheckIns = rawCheckins.filter((checkin: ProfileCheckin) => checkin.userId === user.id && checkin.present !== false);
        setCheckInTotalCount(userCheckIns.length);

        const userWeights = userCheckIns
          .filter((checkin: ProfileCheckin) => checkin.weight != null && Number.isFinite(Number(checkin.weight)) && Number(checkin.weight) > 0)
          .map((checkin: ProfileCheckin) => ({ date: String(checkin.date), weight: Number(checkin.weight) }))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (userWeights.length < 2) {
          setWeightTrendLabel(null);
          return;
        }

        const first = userWeights[0].weight;
        const latest = userWeights[userWeights.length - 1].weight;
        if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(latest)) {
          setWeightTrendLabel(null);
          return;
        }

        const changePct = ((latest - first) / first) * 100;
        const absPct = Math.abs(changePct).toFixed(1);
        if (absPct === "0.0") {
          setWeightTrendLabel("0.0%");
          return;
        }

        setWeightTrendLabel(changePct >= 0 ? `+${absPct}%` : `-${absPct}%`);
      })
      .catch(() => {
        if (!cancelled) {
          setWeightTrendLabel(null);
          setCheckInTotalCount(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const displayWeight = useMemo(() => {
    if (latestCheckinWeight?.weight != null) return String(latestCheckinWeight.weight);
    return "";
  }, [latestCheckinWeight]);

  const pageItems = [
    { id: "profile", label: "Profile", path: DASHBOARD_ROUTES.profile, icon: "👤" },
    { id: "checkin", label: "Check-In", path: DASHBOARD_ROUTES.checkIn, icon: "📝" },
    { id: "train", label: "Train", path: DASHBOARD_ROUTES.workoutHistory, icon: "🕘" },
    { id: "completionist", label: "Completionist", path: DASHBOARD_ROUTES.rankUp, icon: "✅" },
    { id: "community", label: "Community Feed", path: DASHBOARD_ROUTES.community, icon: "🌐" },
    { id: "friends", label: "Friends", path: DASHBOARD_ROUTES.friends, icon: "👥" },
    { id: "exercises", label: "Exercise Library", path: DASHBOARD_ROUTES.exercises, icon: "📚" },
    { id: "settings", label: "Settings", path: DASHBOARD_ROUTES.settings, icon: "⚙️" },
  ] as const;

  const adminItems = user?.role === "admin"
    ? [
        { id: "attendance", label: "Attendance", path: DASHBOARD_ROUTES.attendance, icon: "🗓️" },
        { id: "website-information", label: "Website Information", path: DASHBOARD_ROUTES.websiteInformation, icon: "🛠️" },
        { id: "admin", label: "Admin Panel", path: DASHBOARD_ROUTES.admin, icon: "🛡️" },
      ] as const
    : [];

  const sectionShellStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 62%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
    boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 10px 28px color-mix(in srgb, var(--void-black) 22%, transparent)",
  };

  const flatTileStyle = {
    borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))",
    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 3%, transparent)",
  };

  return (
    <PageLayout
      title="Me"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:py-3">
        <section className="rounded-xl border p-3.5" style={sectionShellStyle}>
          <div className="mb-3 flex items-start justify-between gap-3 border-b pb-3" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ea1ff]">Me</p>
              <h2 className="mt-1 text-[18px] font-semibold text-[#f2f3f5]">Profile & preferences</h2>
              <p className="mt-1 text-[12px] text-[#b5bac1]">A flatter Train-style home for your account, settings, and personal tools.</p>
            </div>
            <span className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8ea1ff]">
              Active
            </span>
          </div>

          {user && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 border-b pb-3" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-[#f2f3f5]"
                  style={{
                    border: "1px solid color-mix(in srgb, var(--accent) 26%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--accent) 16%, var(--ink-mid))",
                    boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 5%, transparent)",
                  }}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-[#f2f3f5]">{user.name}</p>
                  <p className="truncate text-[11px] text-[#949ba4]">@{user.username}</p>
                  <p className="mt-1 text-[12px] text-[#b5bac1]">Open your profile, review your stats, and keep preferences in sync.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Weight</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#f2f3f5]">{displayWeight || "--"}{displayWeight ? " kg" : ""}</p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Trend</p>
                  <p
                    className="mt-1 text-[12px] font-semibold"
                    style={{
                      color:
                        weightTrendLabel?.startsWith("+")
                          ? "var(--difficulty-green)"
                          : weightTrendLabel?.startsWith("-")
                            ? "var(--difficulty-red)"
                            : "#f2f3f5",
                    }}
                  >
                    {weightTrendLabel ?? "--"}
                  </p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Check-ins</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#f2f3f5]">{checkInTotalCount ?? 0}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border p-3.5" style={sectionShellStyle}>
          <div className="mb-2 border-b pb-2" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#8ea1ff]">Navigation</p>
            <h3 className="mt-1 text-[15px] font-semibold text-[#f2f3f5]">Pages</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {pageItems.map((item) => {
              const isCurrent = item.path === DASHBOARD_ROUTES.profile;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="flex min-h-[50px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-[#dbdee1] transition-colors active:bg-[#2b2f36]"
                  style={{
                    border: isCurrent
                      ? "1px solid color-mix(in srgb, var(--accent) 38%, transparent)"
                      : "1px solid color-mix(in srgb, var(--ink-light) 34%, transparent)",
                    backgroundColor: isCurrent
                      ? "color-mix(in srgb, var(--accent) 14%, var(--ink-mid))"
                      : "color-mix(in srgb, var(--ink-mid) 40%, transparent)",
                    boxShadow: isCurrent
                      ? "inset 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 2%, transparent)",
                  }}
                  onClick={() => router.push(item.path)}
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                    style={{ backgroundColor: isCurrent ? "color-mix(in srgb, var(--accent) 18%, transparent)" : "color-mix(in srgb, var(--ink-light) 10%, transparent)" }}
                  >
                    <span className="text-base">{item.icon}</span>
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium">{item.label}</span>
                    <span className="block text-[10px] text-[#a9b0b8]">
                      {item.id === "profile"
                        ? "Current page"
                        : item.id === "checkin"
                          ? "Log your day"
                          : item.id === "settings"
                            ? "App preferences"
                            : item.id === "friends"
                              ? "Social tools"
                              : item.id === "train"
                                ? "Workout history and logs"
                                : item.id === "community"
                                  ? "See everyone’s activity"
                                  : item.id === "completionist"
                                    ? "Track exercise progress"
                                    : "Browse movements"}
                    </span>
                  </div>
                  <span className="text-[12px] text-[#8b949e]">›</span>
                </button>
              );
            })}
          </div>

          {adminItems.length > 0 && (
            <>
              <div className="mb-2 mt-4">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[#f0b96a]">Admin</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {adminItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex min-h-[50px] items-center gap-2.5 rounded-lg px-3 py-2.5 text-[#f0c991] transition-colors"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--gold-glow) 24%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--gold-glow) 8%, transparent)",
                      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 2%, transparent)",
                    }}
                    onClick={() => router.push(item.path)}
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: "color-mix(in srgb, var(--gold-glow) 10%, transparent)" }}
                    >
                      <span className="text-base">{item.icon}</span>
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-medium">{item.label}</span>
                      <span className="block text-[10px] text-[#d6b17d]">
                        {item.id === "admin" ? "Open admin controls" : "Manage site details"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <button
          type="button"
          className="flex min-h-[48px] w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[#ffb3b8] transition-colors active:bg-[#49292f]"
          style={{
            border: "1px solid color-mix(in srgb, var(--danger) 34%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--danger) 10%, transparent)",
            boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 2%, transparent)",
          }}
          onClick={() => logout()}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center">↩</span>
          <div className="text-left">
            <span className="block text-[13px] font-medium">Logout</span>
            <span className="block text-[10px] text-[#e19aa1]">Leave this session safely</span>
          </div>
        </button>
      </div>
    </PageLayout>
  );
}
