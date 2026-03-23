"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput from "@/components/ui/GlowInput";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import DataManagement from "@/components/admin/DataManagement";

interface AdminUser {
  id: string;
  username: string;
  name: string;
  createdAt: string;
  sessionCount?: number;
  progressionLogCount?: number;
  _count?: { checkIns: number };
}

interface SystemStats {
  totalUsers: number;
  totalProgressionLogs: number;
  totalExercises: number;
  totalCheckIns: number;
}

function AdminSidebar() {
  return (
    <div className="space-y-3">
      <GlowCard glow="jade" hoverable={false}>
        <h3 className="text-xs text-jade-glow uppercase mb-2">Administrative Palace</h3>
        <p className="text-xs text-mist-dark">
          Central control chamber for user governance, exercise library operations, and system data management.
        </p>
      </GlowCard>
    </div>
  );
}

export default function AdminPanelPage() {
  const { user, login } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalProgressionLogs: 0,
    totalExercises: 0,
    totalCheckIns: 0,
  });
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if user is admin based on role
  const isAdmin = user?.role === "admin";

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, exercisesRes, checkinsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/exercises"),
        fetch("/api/checkins"),
      ]);

      const usersData = await usersRes.json();
      const exercisesData = await exercisesRes.json();
      const checkinsData = await checkinsRes.json();

      const usersList = usersData.users || [];
      setUsers(usersList);
      const totalLogs = usersList.reduce((sum: number, u: AdminUser) => sum + (u.progressionLogCount ?? 0), 0);
      setStats({
        totalUsers: usersList.length,
        totalProgressionLogs: totalLogs,
        totalExercises: (exercisesData.exercises || []).length,
        totalCheckIns: (checkinsData.checkins || []).length,
      });
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) return;

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          name: newName,
        }),
      });

      if (res.ok) {
        setShowNewUserModal(false);
        setNewUsername("");
        setNewPassword("");
        setNewName("");
        fetchData();
      }
    } catch (err) {
      console.error("Failed to create user:", err);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setShowUserDetailModal(false);
        fetchData();
      }
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  const updateDisplayName = async (userId: string, newDisplayName: string) => {
    if (!newDisplayName.trim()) return;
    setIsSavingName(true);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDisplayName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        // If updating own name, refresh auth state
        if (user && userId === user.id) {
          login({ ...user, name: data.user.name });
        }
        fetchData();
        if (selectedUser && selectedUser.id === userId) {
          setSelectedUser({ ...selectedUser, name: data.user.name });
        }
      }
    } catch (err) {
      console.error("Failed to update display name:", err);
    } finally {
      setIsSavingName(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <PageLayout
        title="Administrative Palace"
        subtitle="System management and user administration"
        sidebar={<AdminSidebar />}
        sidebarLabel="Admin Panel"
      >
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="text-5xl opacity-50">🔒</div>
          <h3 className="text-lg font-semibold text-crimson-light">Access Restricted</h3>
          <p className="text-sm text-mist-dark text-center max-w-md">
            The Administrative Palace is reserved for cultivators with administrative privileges. 
            Please contact the sect leader if you require access.
          </p>
          <GlowButton variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            ← Return to Dao Hall
          </GlowButton>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Administrative Palace"
      subtitle="System management and user administration"
      sidebar={<AdminSidebar />}
      sidebarLabel="Admin Panel"
    >
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-3xl"
          >
            ☯
          </motion.div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* System Statistics */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase mb-3">System Overview</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <GlowCard glow="jade">
                <p className="text-xs text-mist-dark uppercase">Total Users</p>
                <p className="text-2xl font-bold text-jade-glow mt-1">{stats.totalUsers}</p>
              </GlowCard>
              <GlowCard glow="blue">
                <p className="text-xs text-mist-dark uppercase">Training Logs</p>
                <p className="text-2xl font-bold text-mountain-blue-glow mt-1">
                  {stats.totalProgressionLogs}
                </p>
              </GlowCard>
              <GlowCard glow="gold">
                <p className="text-xs text-mist-dark uppercase">Techniques</p>
                <p className="text-2xl font-bold text-gold mt-1">{stats.totalExercises}</p>
              </GlowCard>
              <GlowCard glow="crimson">
                <p className="text-xs text-mist-dark uppercase">Check-Ins</p>
                <p className="text-2xl font-bold text-crimson-light mt-1">{stats.totalCheckIns}</p>
              </GlowCard>
            </div>
          </div>

          {/* Admin Tools */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase mb-3">Admin Tools</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <GlowCard glow="gold" hoverable>
                <button
                  onClick={() => router.push("/dashboard/admin/weight-standards")}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">⚖️</span>
                    <div>
                      <p className="text-sm font-semibold text-cloud-white">Weight Standards</p>
                      <p className="text-xs text-mist-dark mt-0.5">Configure gender-specific weight tier thresholds per exercise</p>
                    </div>
                  </div>
                </button>
              </GlowCard>
            </div>
          </div>

          {/* User Management */}
          <GlowCard glow="jade" hoverable={false}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm text-jade-glow uppercase tracking-wider">User Management</h3>
              <GlowButton variant="jade" size="sm" glow onClick={() => setShowNewUserModal(true)}>
                + Create User
              </GlowButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-light">
                    <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">
                      Username
                    </th>
                    <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Name</th>
                    <th className="px-3 py-2 text-center text-xs text-jade-glow uppercase">
                      Created
                    </th>
                    <th className="px-2 py-2 text-xs text-jade-glow uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-ink-light/50 hover:bg-ink-dark/50 transition-colors"
                    >
                      <td className="px-3 py-2 text-cloud-white">{user.username}</td>
                      <td className="px-3 py-2 text-mist-light">{user.name}</td>
                      <td className="px-3 py-2 text-center text-mist-dark text-xs">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <GlowButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowUserDetailModal(true);
                          }}
                        >
                          View
                        </GlowButton>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>

          {/* Data Management Section */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase mb-3">Library And Records Control</h3>
            <p className="text-xs text-mist-dark mb-3">
              Upload, export, and purge operations for the shared Exercise Library are now managed here.
            </p>
          </div>
          <DataManagement />
        </div>
      )}

      {/* Create User Modal */}
      <GlowModal
        isOpen={showNewUserModal}
        onClose={() => {
          setShowNewUserModal(false);
          setNewUsername("");
          setNewPassword("");
          setNewName("");
        }}
        title="Create New User"
      >
        <div className="space-y-3">
          <GlowInput
            label="Username"
            placeholder="Login username..."
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
          <GlowInput
            label="Full Name"
            placeholder="Display name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <GlowInput
            label="Password"
            type="password"
            placeholder="Set initial password..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <GlowButton variant="jade" glow className="w-full" onClick={createUser}>
            ✓ Create User
          </GlowButton>
        </div>
      </GlowModal>

      {/* User Detail Modal */}
      <GlowModal
        isOpen={showUserDetailModal}
        onClose={() => {
          setShowUserDetailModal(false);
          setSelectedUser(null);
          setEditingName("");
        }}
        title={selectedUser?.name || "User Details"}
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-mist-dark uppercase">Username</p>
                <p className="text-sm text-cloud-white mt-1">{selectedUser.username}</p>
              </div>
              <div>
                <p className="text-xs text-mist-dark uppercase">Sessions</p>
                <p className="text-sm text-blue-glow mt-1">{selectedUser.sessionCount ?? selectedUser.progressionLogCount ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-mist-dark uppercase">Check-Ins</p>
                <p className="text-sm text-gold mt-1">{selectedUser._count?.checkIns || 0}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-mist-dark uppercase">Member Since</p>
              <p className="text-sm text-mist-light mt-1">
                {new Date(selectedUser.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="pt-2 border-t border-ink-light">
              <p className="text-xs text-mist-dark uppercase mb-2">Display Name</p>
              <div className="flex gap-2">
                <GlowInput
                  placeholder="New display name..."
                  value={editingName || selectedUser.name}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <GlowButton
                  variant="jade"
                  size="sm"
                  disabled={isSavingName || !editingName.trim() || editingName.trim() === selectedUser.name}
                  onClick={() => updateDisplayName(selectedUser.id, editingName)}
                >
                  {isSavingName ? "..." : "Save"}
                </GlowButton>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-ink-light">
              <GlowButton
                variant="crimson"
                size="sm"
                onClick={() => deleteUser(selectedUser.id)}
              >
                Delete User
              </GlowButton>
              <GlowButton variant="ghost" size="sm" onClick={() => setShowUserDetailModal(false)}>
                Close
              </GlowButton>
            </div>
          </div>
        )}
      </GlowModal>
    </PageLayout>
  );
}
