"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput from "@/components/ui/GlowInput";
import { useAuth } from "@/context/AuthContext";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";

const REMEMBERED_CREDENTIALS_KEY = "cultivation-remembered-credentials";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stayLoggedIn, setStayLoggedIn] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  // Load remembered credentials on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBERED_CREDENTIALS_KEY);
      if (saved) {
        const { username: savedUser, password: savedPass } = JSON.parse(saved);
        if (savedUser) setUsername(savedUser);
        if (savedPass) setPassword(savedPass);
        setRememberMe(true);
      }
    } catch {}
  }, []);

  // Apply saved theme on mount so login screen matches user's chosen theme
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem("cultivation-theme-style");
      if (savedTheme) {
        const themes = ["midnight-ink", "mountain-mist", "calligraphy", "sakura", "sakura-dark"];
        document.documentElement.classList.remove(...themes);
        if (themes.includes(savedTheme)) {
          document.documentElement.classList.add(savedTheme);
        }
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
      const body = isRegister
        ? { username, password, name }
        : { username, password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "An error occurred");
        return;
      }

      // Save/clear remembered credentials
      if (rememberMe && !isRegister) {
        localStorage.setItem(REMEMBERED_CREDENTIALS_KEY, JSON.stringify({ username, password }));
      } else {
        localStorage.removeItem(REMEMBERED_CREDENTIALS_KEY);
      }

      // Save user session (stayLoggedIn = persist across restarts)
      if (data.user) {
        login(data.user, stayLoggedIn);
      }

      router.push("/dashboard");
    } catch {
      setError("Cannot connect to server/database. If using the Android APK, ensure the app URL is reachable and WireGuard or Tailscale VPN is connected.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 z-20">
        <ConnectivityBanner />
      </div>
      {/* Background mist layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-void-black via-ink-deep to-jade-deep/20" />
      <div className="absolute inset-0 opacity-30">
        <div
          className="absolute top-0 left-1/4 w-96 h-96 bg-jade-deep/20 rounded-full blur-3xl animate-glow-pulse"
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-mountain-blue/10 rounded-full blur-3xl animate-glow-pulse"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute top-1/3 right-1/3 w-64 h-64 bg-crimson-deep/10 rounded-full blur-3xl animate-glow-pulse"
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
            className="absolute w-1 h-1 bg-jade-glow/40 rounded-full"
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

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md mx-4"
      >
        <div className="bg-ink-deep/80 backdrop-blur-xl border border-jade-deep/40 rounded-2xl p-8 glow-subtle">
          {/* Title - bilingual */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center mb-8"
          >
            <h1 className="text-3xl font-bold text-jade-glow mb-1 tracking-wider">
              修炼之路
            </h1>
            <p className="text-xs text-mist-mid tracking-[0.3em] uppercase">
              Path of Cultivation
            </p>
            <div className="mt-4 w-16 h-px bg-gradient-to-r from-transparent via-jade-glow to-transparent mx-auto" />
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
                label="道号 · Dao Name"
                placeholder="Enter your cultivator name"
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
                  label="真名 · True Name"
                  placeholder="Your display name"
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
                  密码 · Secret Art
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your secret art"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 pr-9 text-sm text-cloud-white placeholder:text-mist-dark outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[0_0_12px_rgba(58,143,143,0.3)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-mist-dark hover:text-mist-light transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
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
                    id="stayLoggedIn"
                    checked={stayLoggedIn}
                    onChange={(e) => setStayLoggedIn(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-ink-light bg-ink-dark accent-jade-glow cursor-pointer"
                  />
                  <label htmlFor="stayLoggedIn" className="text-xs text-mist-mid cursor-pointer select-none">
                    长驻 · Stay Logged In
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="rememberMe"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-ink-light bg-ink-dark accent-jade-glow cursor-pointer"
                  />
                  <label htmlFor="rememberMe" className="text-xs text-mist-mid cursor-pointer select-none">
                    记住我 · Remember Credentials
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
                className="w-full"
                disabled={loading}
              >
                {loading
                  ? "Channeling Qi..."
                  : isRegister
                  ? "Begin Cultivation 开始修炼"
                  : "Enter the Sect 进入宗门"}
              </GlowButton>
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
                ? "Already a cultivator? 已有账号 — Return to the sect"
                : "New cultivator? 新弟子 — Join the sect"}
            </button>
          </motion.div>

          {/* Bottom decoration */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <div className="w-8 h-px bg-ink-light" />
            <span className="text-[10px] text-mist-dark">天道酬勤</span>
            <div className="w-8 h-px bg-ink-light" />
          </div>
          <p className="text-center text-[10px] text-mist-dark mt-1">
            Heaven rewards the diligent
          </p>
        </div>
      </motion.div>
    </div>
  );
}
