"use client";

import { useAppContext } from "@/context/AppContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { applyNavigationBarFromCssVar } from "@/utils/navigationBarColor";
import MobileThemePreview from "@/components/mobile/theme/MobileThemePreview";

type ThemeStyle = "midnight-ink" | "mountain-mist" | "calligraphy" | "sakura" | "sakura-dark";

const themePreviews: { id: ThemeStyle; title: string; colors: string[]; favorite?: boolean }[] = [
  { id: "midnight-ink", title: "Midnight Ink", colors: ["#0d0f14", "#151823", "#2d6b6b", "#c4a84a"] },
  { id: "mountain-mist", title: "Mountain Mist", colors: ["#f5f0eb", "#ede7e1", "#4a9e9e", "#a04040"] },
  { id: "calligraphy", title: "Calligraphy", colors: ["#050505", "#1a1a1a", "#d4a860", "#888888"], favorite: true },
  { id: "sakura", title: "Sakura", colors: ["#faf7f6", "#f5f1f0", "#e8507a", "#d8a878"] },
  { id: "sakura-dark", title: "Sakura Dark", colors: ["#0c080e", "#130e16", "#d4508a", "#8870a8"] },
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
