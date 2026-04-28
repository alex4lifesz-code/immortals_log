"use client";

import { useRouter } from "next/navigation";
import EmptyState from "./EmptyState";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

interface EmptyTrainingLogProps {
  lang?: LanguageMode;
}

export default function EmptyTrainingLog({ lang = "english" }: EmptyTrainingLogProps) {
  const router = useRouter();
  const copy = getCopy(lang).emptyStates.trainingLog;

  return (
    <EmptyState
      illustration="training"
      title={copy.title}
      description={copy.description}
      primaryAction={{
        label: copy.primaryCta,
        onClick: () => router.push("/dashboard/train"),
      }}
      secondaryAction={{
        label: copy.secondaryCta,
        onClick: () => router.push("/dashboard/train?library=1"),
      }}
    />
  );
}
