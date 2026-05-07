"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { translateEnglishToLanguage } from "@/lib/language";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { kgToLbs } from "@/lib/unit-conversion";
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
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const weightUnit = settings.defaultWeightUnit ?? "kg";
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
    if (latestCheckinWeight?.weight == null) return "";
    const val = weightUnit === "lbs" ? kgToLbs(latestCheckinWeight.weight) : latestCheckinWeight.weight;
    return `${val} ${weightUnit}`;
  }, [latestCheckinWeight, weightUnit]);

  const pageItems = [
    { id: "progress", label: lt("Progress"), path: DASHBOARD_ROUTES.rankUp, disabled: false },
    { id: "exercises", label: lt("Exercise Library"), path: "/dashboard/train?library=1", disabled: true },
    { id: "workout-history", label: lt("Workout History"), path: "/dashboard/workout/history", disabled: false },
    { id: "settings", label: lt("Settings"), path: DASHBOARD_ROUTES.settings, disabled: false },
  ] as const;

  const adminItems = user?.role === "admin"
    ? [
        { id: "attendance", label: "Check-In Log", path: DASHBOARD_ROUTES.attendance },
        { id: "exercise-db", label: "Exercise DB", path: "/dashboard/exercise-db" },
        { id: "website-information", label: "Website Information", path: DASHBOARD_ROUTES.websiteInformation },
        { id: "admin", label: "Admin Panel", path: DASHBOARD_ROUTES.admin },
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

  const renderMeSectionIcon = (itemId: string, strokeWidth = 1.9) => {
    switch (itemId) {
      case "progress":
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4 10-10" />
          </svg>
        );
      case "exercises":
      case "exercise-db":
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        );
      case "workout-history":
      case "attendance":
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <circle cx="12" cy="12" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5l3 2" />
          </svg>
        );
      case "settings":
      case "website-information":
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 2h3l.8 2.4 2.3 1 2.3-1.1 2.1 2.1-1.1 2.3 1 2.3 2.4.8v3l-2.4.8-1 2.3 1.1 2.3-2.1 2.1-2.3-1.1-2.3 1L13.5 22h-3l-.8-2.4-2.3-1-2.3 1.1-2.1-2.1 1.1-2.3-1-2.3L.7 13.5v-3l2.4-.8 1-2.3-1.1-2.3 2.1-2.1 2.3 1.1 2.3-1L10.5 2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        );
      case "admin":
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 4v5c0 5-3 8-7 9-4-1-7-4-7-9V7l7-4z" />
          </svg>
        );
      default:
        return (
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={strokeWidth}>
            <circle cx="12" cy="12" r="8" />
          </svg>
        );
    }
  };

  return (
    <PageLayout
      title={lt("Me")}
      mobileContentPaddingClass="px-2 pt-4 pb-24"
    >
      <div className="space-y-3 px-0 py-0 sm:py-1">
        <section className="rounded-xl border p-3.5" style={sectionShellStyle}>
          <div className="mb-3 flex items-start justify-between gap-3 border-b pb-3" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}>
            <div>
              <h2 className="mt-1 text-[18px] font-semibold" style={{ color: "var(--text-primary)" }}>{lt("Profile & preferences")}</h2>
            </div>
          </div>

          {user && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 border-b pb-3" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }}>
                <span
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full"
                  style={{
                    color: "var(--text-primary)",
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
                  <p className="truncate text-[14px] font-semibold" style={{ color: "var(--text-primary)" }}>{user.name}</p>
                  <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>@{user.username}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{lt("Weight")}</p>
                  <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{displayWeight || "--"}</p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{lt("Trend")}</p>
                  <p
                    className="mt-1 text-[12px] font-semibold"
                    style={{
                      color:
                        weightTrendLabel?.startsWith("+")
                          ? "var(--difficulty-green)"
                          : weightTrendLabel?.startsWith("-")
                            ? "var(--difficulty-red)"
                            : "var(--text-primary)",
                    }}
                  >
                    {weightTrendLabel ?? "--"}
                  </p>
                </div>
                <div className="rounded-md border px-2.5 py-2" style={flatTileStyle}>
                  <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>{lt("Check-ins")}</p>
                  <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--text-primary)" }}>{checkInTotalCount ?? 0}</p>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border p-3.5" style={sectionShellStyle}>
          <div className="mb-2 border-b pb-2" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}>
            <h3 className="mt-1 text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>{lt("Pages")}</h3>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {pageItems.map((item) => {
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={Boolean(item.disabled)}
                  aria-disabled={Boolean(item.disabled)}
                  className="flex min-h-[46px] items-center gap-2.5 rounded-lg px-3 py-2 transition-colors disabled:cursor-not-allowed"
                  style={{
                    border: item.disabled
                      ? "1px solid color-mix(in srgb, var(--ink-light) 30%, transparent)"
                      : "1px solid color-mix(in srgb, var(--ink-light) 48%, transparent)",
                    backgroundColor: item.disabled
                      ? "color-mix(in srgb, var(--ink-mid) 35%, var(--ink-deep))"
                      : "color-mix(in srgb, var(--ink-mid) 55%, var(--ink-deep))",
                    boxShadow: item.disabled
                      ? "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 1%, transparent)"
                      : "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 2%, transparent)",
                    color: item.disabled ? "var(--text-muted)" : "var(--text-primary)",
                    opacity: item.disabled ? 0.72 : 1,
                  }}
                  onClick={() => {
                    if (item.disabled) return;
                    router.push(item.path);
                  }}
                >
                  <span
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                    style={{
                      backgroundColor: item.disabled
                        ? "color-mix(in srgb, var(--ink-light) 10%, transparent)"
                        : "color-mix(in srgb, var(--ink-light) 14%, transparent)",
                    }}
                    aria-hidden
                  >
                    {renderMeSectionIcon(item.id)}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-[13px] font-medium">{item.label}</span>
                  </div>
                  <span className="text-[12px]" style={{ color: item.disabled ? "color-mix(in srgb, var(--text-muted) 70%, transparent)" : "var(--text-muted)" }}>
                    ›
                  </span>
                </button>
              );
            })}
          </div>

          {adminItems.length > 0 && (
            <>
              <div className="mb-2 mt-4">
                <p className="text-[10px] uppercase tracking-[0.1em]" style={{ color: "var(--text-secondary)" }}>Admin</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {adminItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex min-h-[46px] items-center gap-2.5 rounded-lg px-3 py-2 transition-colors"
                    style={{
                      border: "1px solid color-mix(in srgb, var(--gold-glow) 30%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-mid) 55%, var(--ink-deep))",
                      boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--cloud-white) 2%, transparent)",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => router.push(item.path)}
                  >
                    <span
                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                      style={{ backgroundColor: "color-mix(in srgb, var(--gold-glow) 12%, transparent)" }}
                      aria-hidden
                    >
                      {renderMeSectionIcon(item.id)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[13px] font-medium">{item.label}</span>
                    </div>
                    <span className="text-[12px]" style={{ color: "var(--text-muted)" }}>›</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </section>


      </div>
    </PageLayout>
  );
}
