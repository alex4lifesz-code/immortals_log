"use client";

import { useEffect } from "react";
import { AppProvider } from "@/context/AppContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import DesktopNavBar from "@/components/navigation/DesktopNavBar";
import DesktopSidebar from "@/components/navigation/DesktopSidebar";
import MobileNavBar from "@/components/navigation/MobileNavBar";
import SwipeNavigation from "@/components/navigation/SwipeNavigation";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();
  const { count: incomingFriendRequestCount } = useIncomingFriendRequestsCount(user?.id);

  return (
    <>
      <div className="app-atmosphere h-screen flex flex-col overflow-hidden">
        <div aria-hidden className="ambient-orb pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, var(--jade-glow) 18%, transparent)" }} />
        <div aria-hidden className="ambient-orb pointer-events-none absolute -right-28 top-8 h-64 w-64 rounded-full blur-3xl" style={{ background: "color-mix(in srgb, var(--mountain-blue-glow) 16%, transparent)", animationDelay: "1.3s" }} />
        <DesktopNavBar />
        <ConnectivityBanner />
        <div className="flex-1 flex min-w-0 overflow-y-hidden overflow-x-auto">
          <DesktopSidebar incomingFriendRequestCount={incomingFriendRequestCount} />
          <SwipeNavigation>
            <div className="h-full min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={pathname}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.995 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -8, scale: 0.995 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
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
    </>
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
      <div className="h-screen flex items-center justify-center bg-void-black">
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
