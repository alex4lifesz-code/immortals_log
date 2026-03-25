"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setDisplayName(user?.displayName || user?.name || "");
    setEmail(user?.email || "");
  }, [user]);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      await refreshUser();
      setStatus("Profile updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold text-pure-white">Profile</h1>

      <form onSubmit={onSave} className="space-y-3 rounded-2xl border border-ink-light bg-ink-deep/70 p-4">
        <label className="block text-xs text-mist-light">
          Display Name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm text-cloud-white outline-none focus:border-gold/60" />
        </label>

        <label className="block text-xs text-mist-light">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-ink-light bg-void-black px-3 py-2 text-sm text-cloud-white outline-none focus:border-gold/60" />
        </label>

        <button disabled={saving} className="rounded-lg border border-gold/50 px-4 py-2 text-xs uppercase tracking-wider text-gold-glow hover:bg-gold-dim/20 disabled:opacity-60">
          {saving ? "Saving..." : "Save Profile"}
        </button>

        {status && <p className="text-xs text-mist-light">{status}</p>}
      </form>

      {user?.role === "admin" && (
        <Link href="/admin/users" className="block rounded-xl border border-gold-dim/40 bg-ink-dark/70 px-4 py-3 text-sm text-gold-glow">
          Admin User Management
        </Link>
      )}

      <button onClick={logout} className="rounded-lg border border-crimson/40 px-4 py-2 text-xs uppercase tracking-wider text-crimson-light hover:bg-crimson-deep/20">
        Logout
      </button>
    </section>
  );
}
