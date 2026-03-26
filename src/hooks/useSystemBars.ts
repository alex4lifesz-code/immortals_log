"use client";

import { useEffect } from "react";
import { useAppContext } from "@/context/AppContext";
import { applyNavigationBarFromCssVar } from "@/utils/navigationBarColor";
import { resolveCssVarColor } from "@/utils/colorConversion";
import { setStatusBarColor } from "@/utils/systemBars";

export function useSystemBars() {
  const { themeStyle } = useAppContext();

  useEffect(() => {
    const apply = async () => {
      const status = resolveCssVarColor("--void-black") || resolveCssVarColor("--system-bar-fallback");
      if (status) {
        await setStatusBarColor(status);
      }
      await applyNavigationBarFromCssVar("--ink-deep");
    };

    void apply();
  }, [themeStyle]);
}
