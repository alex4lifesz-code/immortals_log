"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getPersistedUser, persistUser, clearPersistedUser } from "@/lib/storage";

type User = {
  id: string;
  username: string;
  name: string;
  role: string;
  onboardingCompleted?: boolean;
  onboardingSkipped?: boolean;
  onboardingStep?: number;
};

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User, rememberMe?: boolean) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const didHydrateRef = useRef(false);
  const router = useRouter();

  // Hydrate auth state from cookie-based session on mount
  useEffect(() => {
    if (didHydrateRef.current) {
      return;
    }
    didHydrateRef.current = true;

    let cancelled = false;

    async function hydrate() {
      try {
        const persisted = await getPersistedUser();
        if (persisted && !cancelled) {
          try {
            setUser(JSON.parse(persisted) as User);
          } catch {
            await clearPersistedUser();
          }
        }

        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });

        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            await clearPersistedUser();
            if (!cancelled) {
              setUser(null);
            }
          }
          return;
        }

        const data = await res.json();
        const hydratedUser = data.data?.user ?? data.user;
        if (hydratedUser && !cancelled) {
          setUser(hydratedUser);
          const rememberMe = typeof window !== "undefined" && localStorage.getItem("cultivation-remember") === "1";
          await persistUser(JSON.stringify(hydratedUser), rememberMe);
        }
      } catch {
        // Network error — keep any previously persisted user instead of forcing logout
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Fail open after 5 s so a slow auth check does not trap the UI in a loading state.
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setIsLoading(false);
      }
    }, 5000);

    hydrate().finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const login = useCallback((userData: User, rememberMe = false) => {
    setUser(userData);
    void persistUser(JSON.stringify(userData), rememberMe);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    await clearPersistedUser();
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Best-effort — cookie will expire anyway
    }
    localStorage.removeItem("cultivation-nav-state");
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: user !== null,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
