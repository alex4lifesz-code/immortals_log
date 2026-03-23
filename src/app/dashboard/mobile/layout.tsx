"use client";

import type { ReactNode } from "react";
import MobileBottomNav from "@/components/mobile/navigation/MobileBottomNav";
import { NavigationStackProvider } from "@/hooks/useNavigationStack";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { HapticProvider } from "@/providers/HapticProvider";
import { BackButtonProvider } from "@/providers/BackButtonProvider";
import { SystemBarsProvider } from "@/providers/SystemBarsProvider";
import "@/styles/mobile.css";

export default function MobileLayout({ children }: { children: ReactNode }) {
  return (
    <NavigationStackProvider>
      <UnsavedChangesProvider>
        <HapticProvider>
          <SystemBarsProvider>
            <BackButtonProvider>
              <main className="mobile-shell min-h-screen bg-background pb-24 text-foreground">{children}</main>
              <MobileBottomNav />
            </BackButtonProvider>
          </SystemBarsProvider>
        </HapticProvider>
      </UnsavedChangesProvider>
    </NavigationStackProvider>
  );
}
