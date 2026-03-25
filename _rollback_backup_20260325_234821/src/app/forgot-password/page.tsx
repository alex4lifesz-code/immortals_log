"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setStatus(data.message || "If an account exists, reset instructions were sent.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-void-black p-4 text-cloud-white">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-4 rounded-2xl border border-gold-dim/40 bg-ink-deep/75 p-5">
        <h1 className="text-xl font-semibold">Forgot Password</h1>
        <p className="text-sm text-mist-light">Enter your email and we will send reset instructions.</p>

        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm outline-none focus:border-gold/60" />

        <button disabled={submitting} className="w-full rounded-lg border border-gold/50 bg-gold-dim/20 px-4 py-2 text-xs uppercase tracking-wider text-gold-glow">
          {submitting ? "Sending..." : "Send Reset Link"}
        </button>

        {status && <p className="text-xs text-mist-light">{status}</p>}
      </form>
    </main>
  );
}
