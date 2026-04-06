"use client";

import { useRouter } from "next/navigation";
import EmptyState from "./EmptyState";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

interface EmptyCheckinsProps {
  lang?: LanguageMode;
}

export default function EmptyCheckins({ lang = "english" }: EmptyCheckinsProps) {
  const router = useRouter();
  const copy = getCopy(lang).emptyStates.checkins;

  return (
    <EmptyState
      illustration="meditation"
      title={copy.title}
      description={copy.description}
      primaryAction={{
        label: copy.primaryCta,
        onClick: () => router.push("/dashboard/check-in"),
      }}
    />
  );
}
