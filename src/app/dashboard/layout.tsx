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
import AtmosphericBackground from "@/components/atmosphere/AtmosphericBackground";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const { count: incomingFriendRequestCount } = useIncomingFriendRequestsCount(user?.id);
  const { themeStyle, isMobile } = useAppContext();
  const disableMotion = themeStyle === "eternal" || themeStyle === "discord" || prefersReducedMotion;
  const isWorkoutInputFullscreen =
    pathname?.startsWith("/dashboard/train/input/") || pathname?.startsWith("/dashboard/workout-history/input/") || false;

  return (
    <MotionConfig transition={disableMotion ? { duration: 0 } : undefined}>
      <div className="app-atmosphere safe-area-shell h-screen flex flex-col overflow-hidden nyaa-layout">
        <AtmosphericBackground />
        {!isWorkoutInputFullscreen && !isMobile && <NyaaTopNav incomingFriendRequestCount={incomingFriendRequestCount} />}
        {!isWorkoutInputFullscreen && <ConnectivityBanner />}
        <div className="flex-1 flex min-w-0 flex-col overflow-hidden nyaa-content-area">
          <SwipeNavigation>
            <div className="h-full min-w-0 overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={disableMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={disableMotion ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: disableMotion ? 0 : 0.1, ease: "easeOut" }}
                  className="h-full"
                >
                  {children}
                </motion.div>
              </AnimatePresence>
            </div>
          </SwipeNavigation>
        </div>
        {!isWorkoutInputFullscreen && <MobileNavBar incomingFriendRequestCount={incomingFriendRequestCount} />}
      </div>
    </MotionConfig>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Redirect to onboarding if not completed
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.onboardingCompleted && !user.onboardingSkipped) {
      router.replace("/onboarding");
    }
  }, [isLoading, isAuthenticated, user, router]);

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
