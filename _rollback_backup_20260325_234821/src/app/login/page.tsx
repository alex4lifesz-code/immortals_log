"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const redirect =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("redirect") || "/home"
      : "/home";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password, rememberMe }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      login(data.user);
      router.push(redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-void-black p-4 text-cloud-white">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-gold-dim/40 bg-ink-deep/75 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gold">Login</p>
          <h1 className="mt-2 text-2xl font-semibold">Return to Training</h1>
        </div>

        <label className="block text-xs text-mist-light">
          Username or Email
          <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />
        </label>

        <label className="block text-xs text-mist-light">
          Password
          <div className="mt-1 flex rounded-lg border border-ink-light bg-void-black">
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-transparent px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="px-3 text-xs text-mist-light">{showPassword ? "Hide" : "Show"}</button>
          </div>
        </label>

        <label className="flex items-center gap-2 text-xs text-mist-light">
          <input checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} type="checkbox" />
          Remember me
        </label>

        {error && <p className="rounded-md border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">{error}</p>}

        <button disabled={submitting} className="w-full rounded-lg border border-gold/50 bg-gold-dim/20 px-4 py-2 text-xs uppercase tracking-wider text-gold-glow disabled:opacity-60">
          {submitting ? "Logging in..." : "Login"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <Link href="/forgot-password" className="text-mist-light hover:text-cloud-white">Forgot password</Link>
          <Link href="/register" className="text-gold-glow hover:text-gold">Create account</Link>
        </div>
      </form>
    </main>
  );
}
