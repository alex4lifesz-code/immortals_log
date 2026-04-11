"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname } from "next/navigation";
import MobileBottomNav from "@/components/mobile/navigation/MobileBottomNav";
import { NavigationStackProvider } from "@/hooks/useNavigationStack";
import { UnsavedChangesProvider } from "@/hooks/useUnsavedChanges";
import { HapticProvider } from "@/providers/HapticProvider";
import { BackButtonProvider } from "@/providers/BackButtonProvider";
import { SystemBarsProvider } from "@/providers/SystemBarsProvider";
import "@/styles/mobile.css";

export default function MobileLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <NavigationStackProvider>
      <UnsavedChangesProvider>
        <HapticProvider>
          <SystemBarsProvider>
            <BackButtonProvider>
              <main className="mobile-shell min-h-app bg-background text-foreground">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={pathname}
                    className="mobile-page-transition"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </main>
              <MobileBottomNav />
            </BackButtonProvider>
          </SystemBarsProvider>
        </HapticProvider>
      </UnsavedChangesProvider>
    </NavigationStackProvider>
  );
}
