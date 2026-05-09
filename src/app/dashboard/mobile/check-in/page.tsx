"use client";

import { useMemo, useState } from "react";
import MobileToast from "@/components/mobile/feedback/MobileToast";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { formatDateWithPreference, getTodayInTimeZone } from "@/lib/constants";

function clampWeight(value: number) {
  return Math.max(35, Math.min(180, Math.round(value)));
}

export default function MobileCheckinPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const { markDirty, clearDirty } = useUnsavedChanges();
  const haptics = useHapticFeedback();
  const [present, setPresent] = useState(true);
  const [weight, setWeight] = useState(70);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("Check-in saved");
  const [toastTone, setToastTone] = useState<"neutral" | "success" | "error">("success");

  const today = useMemo(() => getTodayInTimeZone(settings.timeZone), [settings.timeZone]);
  const formattedToday = useMemo(
    () => formatDateWithPreference(today, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone),
    [settings.dateFormat, settings.timeZone, today],
  );

  const showToast = (message: string, tone: "neutral" | "success" | "error") => {
    setToastMessage(message);
    setToastTone(tone);
    setToastOpen(true);
    window.setTimeout(() => setToastOpen(false), 1800);
  };

  const submit = async () => {
    if (!user?.id || saving) return;

    setSaving(true);
    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: today,
          entries: {
            [user.id]: {
              present,
              weight: String(weight),
              comment: comment.trim(),
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save check-in");
      }

      clearDirty();
      haptics.medium();
      showToast("Check-in saved", "success");
    } catch {
      showToast("Unable to save check-in", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="page-rise">
        <div className="mx-auto w-full max-w-[1400px]">
        <p className="mb-3 text-xs italic text-mist-dark">Record your daily check-in and recovery notes</p>

        <div className="nyaa-history-page px-0 space-y-4">
          <section style={{ transform: "none" }}>
            <div
              className="border overflow-hidden rounded-tl-2xl"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 20%, var(--ink-deep))",
              }}
            >
              <div
                className="min-h-0 overflow-y-auto scrollbar-hide"
                style={{ height: "calc(100dvh - 5rem)", overscrollBehaviorY: "auto", touchAction: "pan-y" }}
              >
                <div className="sticky top-0 z-20 safe-area-top" style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}>
                  <div
                    className="px-3 py-2.5"
                    style={{ backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--mist-light)" }}>
                        Check-In
                      </h2>
                      <span
                        className="rounded-md border px-3 py-1.5 text-[11px] font-semibold"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 74%, var(--ink-deep))",
                          color: "var(--cloud-white)",
                        }}
                      >
                        {formattedToday}
                      </span>
                    </div>

                    <div className="mt-2 -mx-0.5 overflow-x-auto scrollbar-hide">
                      <div className="flex min-w-max items-center gap-2 px-0.5 pb-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPresent(true);
                            markDirty();
                          }}
                          className="rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors"
                          style={present
                            ? {
                              borderColor: "color-mix(in srgb, var(--accent) 70%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 74%, var(--ink-deep))",
                              color: "var(--cloud-white)",
                            }
                            : {
                              borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 65%, var(--ink-deep))",
                              color: "var(--text-muted)",
                            }}
                        >
                          Checked in
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPresent(false);
                            markDirty();
                          }}
                          className="rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors"
                          style={!present
                            ? {
                              borderColor: "color-mix(in srgb, var(--accent) 70%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 74%, var(--ink-deep))",
                              color: "var(--cloud-white)",
                            }
                            : {
                              borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 65%, var(--ink-deep))",
                              color: "var(--text-muted)",
                            }}
                        >
                          Rest mode
                        </button>
                        <span
                          className="rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap"
                          style={{
                            borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                            backgroundColor: "color-mix(in srgb, var(--ink-mid) 65%, var(--ink-deep))",
                            color: "var(--text-muted)",
                          }}
                        >
                          {settings.timeZone || "Timezone"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="h-px" style={{ backgroundColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)" }} />
                </div>

                <div className="pb-[calc(env(safe-area-inset-bottom,0px)+5.75rem)]">
                  <article className="mx-1 my-0.5 rounded-md px-3 py-2.5" style={{ backgroundColor: "transparent", boxShadow: "none" }}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-muted)" }}>Body weight</p>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>{weight} kg</span>
                    </div>
                    <input
                      type="range"
                      min={35}
                      max={180}
                      step={1}
                      value={weight}
                      onChange={(event) => {
                        setWeight(clampWeight(Number(event.currentTarget.value)));
                        markDirty();
                      }}
                      className="mt-2 h-8 w-full"
                      style={{ accentColor: "var(--accent)" }}
                    />
                    <input
                      type="number"
                      min={35}
                      max={180}
                      step={1}
                      value={weight}
                      onChange={(event) => {
                        const next = Number(event.currentTarget.value);
                        if (Number.isFinite(next)) {
                          setWeight(clampWeight(next));
                          markDirty();
                        }
                      }}
                      className="mt-2 h-8 w-full rounded-md border px-2.5 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    />
                  </article>

                  <article className="mx-1 my-0.5 rounded-md px-3 py-2.5" style={{ backgroundColor: "transparent", boxShadow: "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-muted)" }}>Daily note</p>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>{comment.trim().length} chars</span>
                    </div>
                    <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>Energy, mood, soreness, or recovery</p>
                    <textarea
                      value={comment}
                      onChange={(event) => {
                        setComment(event.currentTarget.value);
                        markDirty();
                      }}
                      placeholder="How are you feeling today?"
                      rows={4}
                      className="mt-2 w-full resize-none rounded-md border px-2.5 py-2 text-sm outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                        color: "var(--cloud-white)",
                      }}
                    />
                  </article>

                  <article className="mx-1 my-0.5 rounded-md px-3 py-2.5" style={{ backgroundColor: "transparent", boxShadow: "none" }}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight" style={{ color: "var(--text-muted)" }}>Preview</p>
                    </div>
                    <p className="mt-0.5 text-[11px] italic" style={{ color: "var(--text-muted)" }}>
                      {present ? "This will log today as present with your current note and weight." : "This will save a recovery note without marking a full check-in."}
                    </p>
                  </article>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>

      <button
        type="button"
        onClick={submit}
        disabled={saving || !user?.id}
        aria-label={saving ? "Saving check-in" : "Save check-in"}
        className="fixed right-[max(env(safe-area-inset-right,0px),0.95rem)] z-[210] flex h-12 w-12 items-center justify-center rounded-2xl border backdrop-blur-sm disabled:opacity-60"
        style={{
          bottom: "var(--mobile-nav-offset, calc(env(safe-area-inset-bottom,0px) + 4.85rem))",
          borderColor: "color-mix(in srgb, var(--accent) 32%, var(--ink-light))",
          backgroundColor: "color-mix(in srgb, var(--accent) 40%, var(--ink-mid))",
          color: "var(--cloud-white)",
          boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 18%, transparent)",
        }}
      >
        {saving ? (
          <span className="text-xs font-semibold">...</span>
        ) : (
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.9}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <MobileToast open={toastOpen} message={toastMessage} tone={toastTone} />
    </>
  );
}
