"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export default function RegisterPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const strength = passwordStrength(password);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!terms) {
      setError("You must accept the terms to continue");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, displayName, password, termsAccepted: terms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");

      localStorage.setItem("wuxia-onboarding-complete", "true");
      login(data.user);
      router.push("/profile-setup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-void-black p-4 text-cloud-white">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-gold-dim/40 bg-ink-deep/75 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-gold">Registration</p>
          <h1 className="mt-2 text-2xl font-semibold">Create Your Account</h1>
        </div>

        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />

        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />
        <div className="h-1.5 w-full overflow-hidden rounded bg-ink-light">
          <div className={`h-full ${strength >= 3 ? "bg-jade" : strength >= 2 ? "bg-gold" : "bg-crimson"}`} style={{ width: `${(strength / 4) * 100}%` }} />
        </div>

        <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />

        <label className="flex items-center gap-2 text-xs text-mist-light">
          <input checked={terms} onChange={(e) => setTerms(e.target.checked)} type="checkbox" />
          I agree to the terms of service
        </label>

        {error && <p className="rounded-md border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">{error}</p>}

        <button disabled={submitting} className="w-full rounded-lg border border-gold/50 bg-gold-dim/20 px-4 py-2 text-xs uppercase tracking-wider text-gold-glow disabled:opacity-60">
          {submitting ? "Creating account..." : "Register"}
        </button>

        <p className="text-center text-xs text-mist-light">
          Already have an account? <Link href="/login" className="text-gold-glow">Login</Link>
        </p>
      </form>
    </main>
  );
}
