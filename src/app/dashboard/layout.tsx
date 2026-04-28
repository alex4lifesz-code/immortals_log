"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppProvider, useAppContext } from "@/context/AppContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MotionConfig, useReducedMotion } from "framer-motion";
import MobileNavBar from "@/components/navigation/MobileNavBar";
import FloatingMobileSidebar from "@/components/navigation/FloatingMobileSidebar";
import SwipeNavigation from "@/components/navigation/SwipeNavigation";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";
import AtmosphericBackground from "@/components/atmosphere/AtmosphericBackground";
import { useIncomingFriendRequestsCount } from "@/hooks/useIncomingFriendRequestsCount";
import { api } from "@/lib/api-client";
import { SystemBarsProvider } from "@/providers/SystemBarsProvider";
import { DASHBOARD_ROUTES } from "@/lib/navigation";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const { count: incomingFriendRequestCount } = useIncomingFriendRequestsCount(user?.id);
  const { themeStyle } = useAppContext();
  const [isTrainExerciseHistoryOpen, setIsTrainExerciseHistoryOpen] = useState(false);
  const disableMotion = themeStyle === "discord" || prefersReducedMotion;
  const isWorkoutInputFullscreen =
    pathname?.startsWith("/dashboard/train/input/") || pathname?.startsWith("/dashboard/workout-history/input/") || false;
  const isFriendDrawerRoute =
    pathname?.startsWith("/dashboard/train")
    && Boolean(searchParams.get("targetUserId"))
    && Boolean(searchParams.get("friendView"));
  const matchesRouteOrChild = (route: string) => pathname === route || pathname?.startsWith(`${route}/`);
  const mobileRootScrollEnabled = !isFriendDrawerRoute;
  const showMobileNav = !isWorkoutInputFullscreen && !isTrainExerciseHistoryOpen;
  const lastLoggedActivityKeyRef = useRef("");

  const currentActivity = useMemo(() => {
    const friendView = searchParams.get("friendView");
    const circleTab = searchParams.get("tab");

    if (matchesRouteOrChild(DASHBOARD_ROUTES.admin)) return { label: "Admin Panel", route: pathname || DASHBOARD_ROUTES.admin };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.websiteInformation)) return { label: "Website Information", route: pathname || DASHBOARD_ROUTES.websiteInformation };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.rankUp)) return { label: "Progress", route: pathname || DASHBOARD_ROUTES.rankUp };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.profile)) return { label: "Profile", route: pathname || DASHBOARD_ROUTES.profile };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.settings)) return { label: "Settings", route: pathname || DASHBOARD_ROUTES.settings };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.checkIn) || matchesRouteOrChild(DASHBOARD_ROUTES.checkinLegacy)) return { label: "Check-In", route: pathname || DASHBOARD_ROUTES.checkIn };
    if (matchesRouteOrChild(DASHBOARD_ROUTES.circle)) {
      const label = circleTab === "members"
        ? "Circle Members"
        : circleTab === "requests"
          ? "Circle Requests"
          : "Circle";
      return { label, route: pathname || DASHBOARD_ROUTES.circle };
    }
    if (matchesRouteOrChild(DASHBOARD_ROUTES.workoutHistory)) {
      const isLibrary = searchParams.get("library") === "1" && !friendView;
      const label = isLibrary
        ? "Exercise Library"
        : friendView === "history"
          ? "Friend History"
          : friendView === "chart"
            ? "Friend Chart"
            : friendView === "checkin"
              ? "Friend Check-In"
              : friendView === "chat"
                ? "Friend Chat"
                : "Train";
      return { label, route: pathname || DASHBOARD_ROUTES.workoutHistory };
    }

    return { label: "Dashboard", route: pathname || DASHBOARD_ROUTES.root };
  }, [matchesRouteOrChild, pathname, searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onVisibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      setIsTrainExerciseHistoryOpen(Boolean(detail?.open));
    };

    window.addEventListener("train-exercise-history-visibility", onVisibilityChange as EventListener);
    return () => {
      window.removeEventListener("train-exercise-history-visibility", onVisibilityChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard/train")) {
      setIsTrainExerciseHistoryOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || !currentActivity.route) return;

    const activityKey = `${currentActivity.label}:${currentActivity.route}:${searchParams.toString()}`;
    if (lastLoggedActivityKeyRef.current === activityKey) return;
    lastLoggedActivityKeyRef.current = activityKey;

    const timer = window.setTimeout(() => {
      api.put("/api/users/preferences", {
        appPrefs: {
          activityEvent: {
            at: new Date().toISOString(),
            label: currentActivity.label,
            route: currentActivity.route,
          },
        },
      }).catch(() => {
        // Ignore activity sync errors.
      });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [currentActivity.label, currentActivity.route, searchParams, user?.id]);

  return (
    <MotionConfig transition={disableMotion ? { duration: 0 } : undefined}>
      <div className="app-atmosphere safe-area-shell h-app flex overflow-hidden nyaa-layout">
        <AtmosphericBackground />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!isWorkoutInputFullscreen && <ConnectivityBanner />}
          <div className="flex-1 flex min-w-0 flex-col overflow-hidden nyaa-content-area">
            <SwipeNavigation>
              <div
                data-mobile-scroll-container={mobileRootScrollEnabled ? "true" : undefined}
                className={`h-full min-w-0 ${!mobileRootScrollEnabled ? "overflow-hidden" : "overflow-y-auto"}`}
              >
                <div key={`${pathname}-${searchParams.toString()}-${themeStyle}`} className="h-full">
                  {children}
                </div>
                {showMobileNav && mobileRootScrollEnabled ? <div aria-hidden="true" className="h-[calc(env(safe-area-inset-bottom,0px)+4.25rem)]" /> : null}
              </div>
            </SwipeNavigation>
          </div>
        </div>
        <FloatingMobileSidebar />
        {showMobileNav && (
          <MobileNavBar
            incomingFriendRequestCount={incomingFriendRequestCount}
            isTrainExerciseHistoryOpen={isTrainExerciseHistoryOpen}
          />
        )}
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
      <div className="safe-area-shell h-app flex items-center justify-center bg-void-black">
        <p className="text-mist-mid text-sm animate-pulse">Restoring session…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppProvider>
      <DisplaySettingsProvider>
        <SystemBarsProvider>
          <DashboardContent>{children}</DashboardContent>
        </SystemBarsProvider>
      </DisplaySettingsProvider>
    </AppProvider>
  );
}
