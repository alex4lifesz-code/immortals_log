"use client";

import { useRouter } from "next/navigation";
import EmptyState from "./EmptyState";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

interface EmptyProgressProps {
  lang?: LanguageMode;
  sessionsLogged?: number;
  sessionsRequired?: number;
}

export default function EmptyProgress({
  lang = "english",
  sessionsLogged = 0,
  sessionsRequired,
}: EmptyProgressProps) {
  const router = useRouter();
  const copy = getCopy(lang).emptyStates.progress;

  return (
    <EmptyState
      illustration="mountain"
      title={copy.title}
      description={copy.description}
      primaryAction={{
        label: copy.primaryCta,
        onClick: () => router.push("/dashboard/train"),
      }}
      extra={
        sessionsRequired != null ? (
          <div className="mb-6 w-full max-w-xs">
            <div className="flex justify-between text-xs text-mist-mid mb-1.5">
              <span>
                {sessionsLogged}/{sessionsRequired} {copy.progressLabel}
              </span>
            </div>
            <div className="w-full h-2 bg-ink-deep rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-jade-deep to-jade-glow rounded-full transition-all duration-500"
                style={{ width: `${Math.min((sessionsLogged / sessionsRequired) * 100, 100)}%` }}
              />
            </div>
          </div>
        ) : undefined
      }
    />
  );
}
