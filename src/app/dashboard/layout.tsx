"use client";

import { useEffect } from "react";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from "framer-motion";
import MobileNavBar from "@/components/navigation/MobileNavBar";
import SwipeNavigation from "@/components/navigation/SwipeNavigation";
import NyaaTopNav from "@/components/navigation/NyaaTopNav";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const { count: incomingFriendRequestCount } = useIncomingFriendRequestsCount(user?.id);
  const { themeStyle } = useAppContext();
  const disableMotion = themeStyle === "eternal" || themeStyle === "discord" || prefersReducedMotion;

  return (
    <MotionConfig transition={disableMotion ? { duration: 0 } : undefined}>
      <div className="app-atmosphere safe-area-shell h-screen flex flex-col overflow-hidden nyaa-layout">
        <NyaaTopNav incomingFriendRequestCount={incomingFriendRequestCount} />
        <ConnectivityBanner />
        <div className="flex-1 flex min-w-0 flex-col overflow-hidden nyaa-content-area">
          <SwipeNavigation>
            <div className="h-full min-w-0 overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={disableMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={disableMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: disableMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </SwipeNavigation>
        </div>
        <MobileNavBar incomingFriendRequestCount={incomingFriendRequestCount} />
      </div>
    </MotionConfig>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="safe-area-shell h-screen flex items-center justify-center bg-void-black">
        <p className="text-mist-mid text-sm animate-pulse">Restoring session…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppProvider>
      <DisplaySettingsProvider>
        <DashboardContent>{children}</DashboardContent>
      </DisplaySettingsProvider>
    </AppProvider>
  );
}
