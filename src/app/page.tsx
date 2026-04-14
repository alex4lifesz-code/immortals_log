"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput from "@/components/ui/GlowInput";
import { useAuth } from "@/context/AuthContext";
import { CONFIG } from "@/lib/config";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";
import type { LanguageMode } from "@/lib/language";
import { translateEnglishToLanguage } from "@/lib/language";

export default function LoginPage() {
  const DISPLAY_SETTINGS_STORAGE_KEY = "cultivateos-display-settings";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [languageMode, setLanguageMode] = useState<LanguageMode>("english");
  const [currentTheme, setCurrentTheme] = useState<string>("");
  const router = useRouter();
  const { login } = useAuth();

  // Apply saved theme on mount so login screen matches user's chosen theme
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("cultivation-theme-style");
      if (savedTheme) {
        const themes: readonly string[] = CONFIG.themes;
        document.documentElement.classList.remove(...themes);
        if (themes.includes(savedTheme)) {
          document.documentElement.classList.add(savedTheme);
          setCurrentTheme(savedTheme);
        }
      }

      const rawDisplaySettings = localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
      if (rawDisplaySettings) {
        const parsed = JSON.parse(rawDisplaySettings) as { languageMode?: LanguageMode };
        if (parsed.languageMode === "english" || parsed.languageMode === "vietnamese") {
          setLanguageMode(parsed.languageMode);
        }
      }
    } catch {}
  }, []);

  const persistLanguageMode = (mode: LanguageMode) => {
    setLanguageMode(mode);
    try {
      const raw = localStorage.getItem(DISPLAY_SETTINGS_STORAGE_KEY);
      const current = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const next = {
        ...current,
        languageMode: mode,
        ...(mode === "vietnamese" ? { showExerciseForeignLanguage: true } : {}),
      };
      localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors.
    }
  };

  const lt = (englishText: string) => translateEnglishToLanguage(englishText, languageMode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { username, password, name }
        : { username, password, rememberMe };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = typeof data.error === "string" ? data.error : data.error?.message ?? "An error occurred";
        setError(msg);
        return;
      }

      // Set user in auth context (cookie is set by server)
      // API returns { success, data: { user } } via apiSuccess wrapper
      const userData = data.data?.user ?? data.user;
      if (userData) {
        login(userData, rememberMe);
      }

      // New registrations go to onboarding, logins go to dashboard
      if (isRegister) {
        router.push("/onboarding");
      } else {
        // Existing users who haven't completed onboarding also redirect
        if (userData && !userData.onboardingCompleted && !userData.onboardingSkipped) {
          router.push("/onboarding");
        } else {
          router.push("/dashboard");
        }
      }
    } catch {
      setError("Cannot connect to server/database. If using the Android APK, ensure the app URL is reachable and WireGuard or Tailscale VPN is connected.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="safe-area-shell min-h-app flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 z-20">
        <ConnectivityBanner />
      </div>
      {/* Background mist layers — forced dark regardless of theme */}
      <div className="absolute inset-0 login-atmosphere" />
      <div className="absolute inset-0 login-orbs">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl animate-glow-pulse"
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-3xl animate-glow-pulse"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/3 right-1/3 w-64 h-64 rounded-full blur-3xl animate-glow-pulse"
          style={{ animationDelay: "3s" }}
        />
      </div>

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => {
        // Use deterministic values based on index to avoid hydration mismatch
        const randomSeed = (i * 12321) % 100;
        const topOffset = 60 + (randomSeed % 20);
        const xOffset = (randomSeed % 40) - 20;
        const duration = 4 + (randomSeed % 3);

        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full login-particle"
            animate={{
              y: [0, -100, 0],
              x: [0, xOffset, 0],
              opacity: [0, 0.8, 0],
            }}
            transition={{
              duration: duration,
              repeat: Infinity,
              delay: i * 0.8,
            }}
            style={{
              left: `${15 + i * 14}%`,
              top: `${topOffset}%`,
            }}
          />
        );
      })}

      {/* Document theme — ink wash mountain silhouettes */}
      {currentTheme === "document" && (
        <>
          {/* Distant mountain range — bottom of viewport */}
          <svg
            className="absolute bottom-0 left-0 w-full pointer-events-none opacity-[0.08]"
            viewBox="0 0 1200 200"
            preserveAspectRatio="none"
            style={{ height: "30vh" }}
          >
            <path
              d="M0 200 L0 140 Q60 80 120 110 Q180 60 250 90 Q320 40 400 70 Q450 30 520 60 Q580 20 650 55 Q720 35 800 65 Q860 25 930 50 Q980 40 1050 70 Q1120 50 1200 80 L1200 200 Z"
              fill="rgba(80, 60, 40, 0.6)"
            />
            <path
              d="M0 200 L0 160 Q80 120 160 140 Q240 100 340 125 Q420 85 500 110 Q560 70 650 95 Q740 80 840 105 Q920 75 1000 100 Q1080 85 1200 110 L1200 200 Z"
              fill="rgba(58, 88, 160, 0.3)"
            />
          </svg>

          {/* Calligraphic seal stamp — top right corner */}
          <div
            className="absolute top-[12%] right-[8%] pointer-events-none opacity-[0.07] rotate-[-8deg]"
          >
            <svg viewBox="0 0 80 80" className="w-20 h-20">
              <rect x="4" y="4" width="72" height="72" rx="4" fill="none" stroke="#903030" strokeWidth="3" />
              <rect x="10" y="10" width="60" height="60" rx="2" fill="none" stroke="#903030" strokeWidth="1" />
              {/* Abstract seal characters */}
              <line x1="25" y1="28" x2="55" y2="28" stroke="#903030" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="25" y1="40" x2="55" y2="40" stroke="#903030" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="25" y1="52" x2="55" y2="52" stroke="#903030" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="33" y1="22" x2="33" y2="58" stroke="#903030" strokeWidth="2" strokeLinecap="round" />
              <line x1="47" y1="22" x2="47" y2="58" stroke="#903030" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </>
      )}

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="login-panel rounded-2xl p-8 glow-subtle">
          {/* Document theme — scroll corner ornaments */}
          {currentTheme === "document" && (
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              {/* Top-left corner ornament */}
              <svg className="absolute top-2 left-2 w-8 h-8 opacity-20" viewBox="0 0 32 32">
                <path d="M2 2 L2 14 Q2 2 14 2" fill="none" stroke="#8a7040" strokeWidth="1.5" />
                <circle cx="2" cy="2" r="1.5" fill="#8a7040" />
              </svg>
              {/* Top-right corner ornament */}
              <svg className="absolute top-2 right-2 w-8 h-8 opacity-20" viewBox="0 0 32 32">
                <path d="M30 2 L30 14 Q30 2 18 2" fill="none" stroke="#8a7040" strokeWidth="1.5" />
                <circle cx="30" cy="2" r="1.5" fill="#8a7040" />
              </svg>
              {/* Bottom-left corner ornament */}
              <svg className="absolute bottom-2 left-2 w-8 h-8 opacity-20" viewBox="0 0 32 32">
                <path d="M2 30 L2 18 Q2 30 14 30" fill="none" stroke="#8a7040" strokeWidth="1.5" />
                <circle cx="2" cy="30" r="1.5" fill="#8a7040" />
              </svg>
              {/* Bottom-right corner ornament */}
              <svg className="absolute bottom-2 right-2 w-8 h-8 opacity-20" viewBox="0 0 32 32">
                <path d="M30 30 L30 18 Q30 30 18 30" fill="none" stroke="#8a7040" strokeWidth="1.5" />
                <circle cx="30" cy="30" r="1.5" fill="#8a7040" />
              </svg>
            </div>
          )}

          {/* Title - bilingual */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-jade-light mb-1 tracking-wider">
              修炼之路
            </h1>
            <p className="text-xs text-mist-mid tracking-[0.3em] uppercase">
              Path of Cultivation
            </p>
            <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-jade-light to-transparent mx-auto" />
          </motion.div>

          {/* Decorative subtitle */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-mist-dark text-xs mb-6 italic"
          >
            {isRegister ? "踏入修仙界 — Enter the realm of cultivation" : "欢迎回来，修士 — Welcome back, cultivator"}
          </motion.p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <GlowInput
                label={`道号 · ${lt("Dao Name")}`}
                placeholder={lt("Enter your cultivator name")}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </motion.div>

            {isRegister && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                <GlowInput
                  label={`真名 · ${lt("True Name")}`}
                  placeholder={lt("Your display name")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <div className="space-y-1">
                <label className="block text-xs text-mist-light tracking-wider uppercase">
                  密码 · {lt("Secret Art")}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder={lt("Enter your secret art")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 pr-9 text-sm text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[var(--glow-jade)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-mist-light transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? lt("Hide password") : lt("Show password")}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Login options */}
            {!isRegister && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-ink-light bg-ink-dark accent-jade-glow cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-xs text-mist-mid cursor-pointer select-none">
                    记住我 · {lt("Remember Me")}
                  </label>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-crimson-light text-xs text-center"
              >
                {error}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-2"
            >
              <GlowButton
                type="submit"
                variant="jade"
                size="lg"
                glow
                className="w-full !border-jade-glow/80 hover:!border-jade-light"
                style={{ backgroundColor: 'var(--jade-glow)', color: '#ffffff' }}
                disabled={loading}
              >
                {loading
                  ? lt("Channeling Qi...")
                  : isRegister
                  ? `${lt("Begin Cultivation")} 开始修炼`
                  : `${lt("Enter the Sect")} 进入宗门`}
              </GlowButton>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.64 }}
              className="flex items-center justify-center gap-2"
            >
              <button
                type="button"
                onClick={() => persistLanguageMode("english")}
                className="rounded border px-2 py-1 text-[10px] login-lang-btn"
                style={{
                  borderColor: languageMode === "english" ? "var(--jade-glow)" : "rgba(60, 70, 90, 0.5)",
                  color: languageMode === "english" ? "var(--jade-glow)" : "#9eaab6",
                  backgroundColor: "rgba(10, 14, 22, 0.5)",
                }}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => persistLanguageMode("vietnamese")}
                className="rounded border px-2 py-1 text-[10px] login-lang-btn"
                style={{
                  borderColor: languageMode === "vietnamese" ? "var(--jade-glow)" : "rgba(60, 70, 90, 0.5)",
                  color: languageMode === "vietnamese" ? "var(--jade-glow)" : "#9eaab6",
                  backgroundColor: "rgba(10, 14, 22, 0.5)",
                }}
              >
                Tiếng Việt
              </button>
            </motion.div>
          </form>

          {/* Toggle register/login */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-6 text-center"
          >
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError("");
              }}
              className="text-xs text-mist-mid hover:text-jade-glow transition-colors"
            >
              {isRegister
                ? `${lt("Already a cultivator?")} 已有账号 — ${lt("Return to the sect")}`
                : `${lt("New cultivator?")} 新弟子 — ${lt("Join the sect")}`}
            </button>
          </motion.div>

          {/* Bottom decoration */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="w-8 h-px bg-ink-light" />
            <span className="text-[10px] text-mist-dark">天道酬勤</span>
            <div className="w-8 h-px bg-ink-light" />
          </div>
          <p className="text-center text-[10px] text-mist-dark mt-1">
            {lt("Heaven rewards the diligent")}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
