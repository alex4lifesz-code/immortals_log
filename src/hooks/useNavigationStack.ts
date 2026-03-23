"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface NavigationStackContextValue {
  canGoBack: boolean;
  pushPath: (path: string) => void;
  goBack: () => void;
  stack: string[];
  pathname: string;
}

const NavigationStackContext = createContext<NavigationStackContextValue | null>(null);

export function NavigationStackProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [stack, setStack] = useState<string[]>([]);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    if (previous.current === null) {
      previous.current = pathname;
      return;
    }
    if (previous.current !== pathname) {
      setStack((curr) => [...curr, previous.current as string]);
      previous.current = pathname;
    }
  }, [pathname]);

  const pushPath = useCallback(
    (path: string) => {
      if (!path) return;
      router.push(path);
    },
    [router],
  );

  const goBack = useCallback(() => {
    setStack((curr) => {
      const next = [...curr];
      const target = next.pop();
      if (target) {
        router.push(target);
      } else {
        router.back();
      }
      return next;
    });
  }, [router]);

  const value = useMemo(
    () => ({
      canGoBack: stack.length > 0,
      pushPath,
      goBack,
      stack,
      pathname: pathname || "",
    }),
    [goBack, pathname, pushPath, stack],
  );

  return createElement(NavigationStackContext.Provider, { value }, children);
}

export function useNavigationStack() {
  const ctx = useContext(NavigationStackContext);
  if (!ctx) {
    throw new Error("useNavigationStack must be used within NavigationStackProvider");
  }
  return ctx;
}
