"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type AdminUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.replace("/home");
      return;
    }

    if (!user) return;

    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => setRows(data.users || []));
  }, [user, router]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) =>
      [r.username, r.email || "", r.displayName || ""].some((v) => v.toLowerCase().includes(q))
    );
  }, [rows, search]);

  const toggleActive = async (target: AdminUser) => {
    const res = await fetch(`/api/admin/users/${target.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !target.isActive }),
    });
    if (!res.ok) return;
    setRows((prev) => prev.map((row) => (row.id === target.id ? { ...row, isActive: !row.isActive } : row)));
  };

  return (
    <main className="min-h-screen bg-void-black px-4 py-6 text-cloud-white">
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-2xl font-semibold">Admin User Management</h1>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users"
          className="w-full rounded-lg border border-ink-light bg-ink-deep px-3 py-2 text-sm outline-none focus:border-gold/60"
        />

        <div className="overflow-hidden rounded-xl border border-ink-light">
          {filtered.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-b border-ink-light/50 bg-ink-dark/70 px-3 py-3 last:border-b-0">
              <div>
                <p className="text-sm text-cloud-white">{row.displayName || row.username}</p>
                <p className="text-xs text-mist-light">{row.username} {row.email ? `| ${row.email}` : ""}</p>
              </div>
              <button
                onClick={() => toggleActive(row)}
                className={`rounded-md px-3 py-1 text-xs ${row.isActive ? "border border-crimson/40 text-crimson-light" : "border border-jade/40 text-jade-light"}`}
              >
                {row.isActive ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
