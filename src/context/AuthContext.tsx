"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

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
  login: (user: User) => void;
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
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setUser(null);
          return;
        }
        const data = await res.json();
        if (data.user && !cancelled) {
          setUser(data.user);
        }
      } catch {
        // Network error — leave user as null
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    // Hard timeout: if hydration hasn't completed in 5 s, force-finish
    const timeout = setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        setIsLoading(false);
      }
    }, 5000);

    hydrate().finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
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
