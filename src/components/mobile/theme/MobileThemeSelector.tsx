"use client";

import { useAppContext } from "@/context/AppContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { applyNavigationBarFromCssVar } from "@/utils/navigationBarColor";
import MobileThemePreview from "@/components/mobile/theme/MobileThemePreview";
import type { Theme } from "@/lib/config";

type ThemeStyle = Theme;

const themePreviews: { id: ThemeStyle; title: string; colors: string[]; favorite?: boolean }[] = [
  {
    id: "midnight-ink",
    title: "Midnight Ink",
    colors: [
      "var(--theme-preview-midnight-1)",
      "var(--theme-preview-midnight-2)",
      "var(--theme-preview-midnight-3)",
      "var(--theme-preview-midnight-4)",
    ],
  },
  {
    id: "mountain-mist",
    title: "Mountain Mist",
    colors: [
      "var(--theme-preview-mountain-1)",
      "var(--theme-preview-mountain-2)",
      "var(--theme-preview-mountain-3)",
      "var(--theme-preview-mountain-4)",
    ],
  },
  {
    id: "calligraphy",
    title: "Calligraphy",
    colors: [
      "var(--theme-preview-calligraphy-1)",
      "var(--theme-preview-calligraphy-2)",
      "var(--theme-preview-calligraphy-3)",
      "var(--theme-preview-calligraphy-4)",
    ],
    favorite: true,
  },
  {
    id: "sakura",
    title: "Sakura",
    colors: [
      "var(--theme-preview-sakura-1)",
      "var(--theme-preview-sakura-2)",
      "var(--theme-preview-sakura-3)",
      "var(--theme-preview-sakura-4)",
    ],
  },
  {
    id: "sakura-dark",
    title: "Sakura Dark",
    colors: [
      "var(--theme-preview-sakura-dark-1)",
      "var(--theme-preview-sakura-dark-2)",
      "var(--theme-preview-sakura-dark-3)",
      "var(--theme-preview-sakura-dark-4)",
    ],
  },
  {
    id: "eternal",
    title: "Eternal",
    colors: [
      "var(--theme-preview-eternal-1)",
      "var(--theme-preview-eternal-2)",
      "var(--theme-preview-eternal-3)",
      "var(--theme-preview-eternal-4)",
    ],
    favorite: true,
  },
  {
    id: "discord",
    title: "Discord",
    colors: [
      "var(--theme-preview-discord-1)",
      "var(--theme-preview-discord-2)",
      "var(--theme-preview-discord-3)",
      "var(--theme-preview-discord-4)",
    ],
  },
  {
    id: "document",
    title: "Document",
    colors: [
      "var(--theme-preview-document-1)",
      "var(--theme-preview-document-2)",
      "var(--theme-preview-document-3)",
      "var(--theme-preview-document-4)",
    ],
  },
  {
    id: "nyaa",
    title: "Nyaa",
    colors: [
      "var(--theme-preview-nyaa-1)",
      "var(--theme-preview-nyaa-2)",
      "var(--theme-preview-nyaa-3)",
      "var(--theme-preview-nyaa-4)",
    ],
    favorite: true,
  },
];

export default function MobileThemeSelector() {
  const { themeStyle, setThemeStyle } = useAppContext();
  const haptics = useHapticFeedback();

  return (
    <div className="grid gap-3">
      {themePreviews.map((theme) => (
        <MobileThemePreview
          key={theme.id}
          title={theme.title}
          colors={theme.colors}
          favorite={theme.favorite}
          active={themeStyle === theme.id}
          onClick={() => {
            setThemeStyle(theme.id);
            haptics.medium();
            void applyNavigationBarFromCssVar("--ink-deep");
          }}
        />
      ))}
    </div>
  );
}
