"use client";

import { useAppContext } from "@/context/AppContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { applyNavigationBarFromCssVar } from "@/utils/navigationBarColor";
import MobileThemePreview from "@/components/mobile/theme/MobileThemePreview";
import type { Theme } from "@/lib/config";

type ThemeStyle = Theme;

const themePreviews: { id: ThemeStyle; title: string; colors: string[]; favorite?: boolean }[] = [
  {
    id: "discord",
    title: "Discord theme",
    colors: [
      "var(--theme-preview-discord-1)",
      "var(--theme-preview-discord-2)",
      "var(--theme-preview-discord-3)",
      "var(--theme-preview-discord-4)",
    ],
    favorite: true,
  },
  {
    id: "forest",
    title: "Forest",
    colors: [
      "var(--theme-preview-forest-1)",
      "var(--theme-preview-forest-2)",
      "var(--theme-preview-forest-3)",
      "var(--theme-preview-forest-4)",
    ],
  },
  {
    id: "ink-dragon",
    title: "Ink Dragon",
    colors: [
      "var(--theme-preview-ink-dragon-1)",
      "var(--theme-preview-ink-dragon-2)",
      "var(--theme-preview-ink-dragon-3)",
      "var(--theme-preview-ink-dragon-4)",
    ],
  },
  {
    id: "frost-sect",
    title: "Frost Sect",
    colors: [
      "var(--theme-preview-frost-sect-1)",
      "var(--theme-preview-frost-sect-2)",
      "var(--theme-preview-frost-sect-3)",
      "var(--theme-preview-frost-sect-4)",
    ],
  },
  {
    id: "heavenly-sword",
    title: "Heavenly Sword",
    colors: [
      "var(--theme-preview-heavenly-sword-1)",
      "var(--theme-preview-heavenly-sword-2)",
      "var(--theme-preview-heavenly-sword-3)",
      "var(--theme-preview-heavenly-sword-4)",
    ],
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
