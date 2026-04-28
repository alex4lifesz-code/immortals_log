"use client";

import { useRouter } from "next/navigation";
import EmptyState from "./EmptyState";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

interface EmptyFeedProps {
  lang?: LanguageMode;
}

export default function EmptyFeed({ lang = "english" }: EmptyFeedProps) {
  const router = useRouter();
  const copy = getCopy(lang).emptyStates.feed;

  return (
    <EmptyState
      illustration="community"
      title={copy.title}
      description={copy.description}
      primaryAction={{
        label: copy.primaryCta,
        onClick: () => router.push("/dashboard/circle?tab=members"),
      }}
      secondaryAction={{
        label: copy.secondaryCta,
        onClick: () => router.push("/dashboard/circle?tab=members"),
      }}
    />
  );
}
