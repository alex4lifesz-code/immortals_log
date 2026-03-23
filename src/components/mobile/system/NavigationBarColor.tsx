"use client";

import { useEffect } from "react";
import { applyNavigationBarFromCssVar } from "@/utils/navigationBarColor";

interface NavigationBarColorProps {
  cssVar?: string;
}

export default function NavigationBarColor({ cssVar = "--ink-deep" }: NavigationBarColorProps) {
  useEffect(() => {
    void applyNavigationBarFromCssVar(cssVar);
  }, [cssVar]);

  return null;
}
