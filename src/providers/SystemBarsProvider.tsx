"use client";

import type { ReactNode } from "react";
import SystemBarsManager from "@/components/mobile/system/SystemBarsManager";

export function SystemBarsProvider({ children }: { children: ReactNode }) {
  return (
    <>
      <SystemBarsManager />
      {children}
    </>
  );
}
