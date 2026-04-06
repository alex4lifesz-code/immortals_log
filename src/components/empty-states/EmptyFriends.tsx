"use client";

import EmptyState from "./EmptyState";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";

interface EmptyFriendsProps {
  lang?: LanguageMode;
  friendCode?: string;
  onShareCode?: () => void;
  onAddFriend?: () => void;
}

export default function EmptyFriends({
  lang = "english",
  friendCode,
  onShareCode,
  onAddFriend,
}: EmptyFriendsProps) {
  const copy = getCopy(lang).emptyStates.friends;

  return (
    <EmptyState
      illustration="community"
      title={copy.title}
      description={copy.description}
      primaryAction={
        onShareCode
          ? { label: copy.primaryCta, onClick: onShareCode }
          : undefined
      }
      secondaryAction={
        onAddFriend
          ? { label: copy.secondaryCta, onClick: onAddFriend }
          : undefined
      }
      extra={
        friendCode ? (
          <div className="mb-6 p-3 rounded-xl bg-ink-deep/50 border border-jade/20 w-full max-w-xs">
            <p className="text-xs text-mist-mid mb-1">Your Cultivation Code</p>
            <p className="text-jade-light font-mono text-lg tracking-wider font-bold">{friendCode}</p>
          </div>
        ) : undefined
      }
    />
  );
}
