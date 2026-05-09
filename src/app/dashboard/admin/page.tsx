"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowInput from "@/components/ui/GlowInput";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter } from "next/navigation";
import DataManagement from "@/components/admin/DataManagement";
import { api } from "@/lib/api-client";
import { formatDateTimeWithPreference, formatDateWithPreference } from "@/lib/constants";
import { translateEnglishToLanguage } from "@/lib/language";

interface AdminActivityEntry {
  at: string;
  label: string;
  route: string;
}

interface AdminUser {
  id: string;
  username: string;
  name: string;
  role?: string;
  createdAt: string;
  sessionCount?: number;
  progressionLogCount?: number;
  lastActivityAt?: string | null;
  lastActivityLabel?: string | null;
  activityLog?: AdminActivityEntry[];
  _count?: { checkIns: number };
}

interface SystemStats {
  totalUsers: number;
  totalProgressionLogs: number;
  totalExercises: number;
  totalCheckIns: number;
}

interface RecycleBinUser {
  archiveId: string;
  id: string;
  username: string;
  name: string;
  role: string;
  createdAt: string;
  deletedAt: string;
  summary: {
    progressionLogCount: number;
    progressionLevelCount: number;
    checkInCount: number;
    noteCount: number;
    ownedExerciseCount: number;
  };
}

interface AdminFriendRequest {
  id: string;
  status: string;
  createdAt: string;
  requester: { id: string; name: string; username: string };
  receiver: { id: string; name: string; username: string };
}

interface StatCardConfig {
  id: string;
  label: string;
  value: number;
  glow: "jade" | "blue" | "gold" | "crimson";
  valueClassName: string;
}

function AdminSidebar() {
  return (
    <div className="dashboard-sidebar-shell">
      <div className="dashboard-sidebar-scroll sidebar-scroll space-y-3">
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-xs text-jade-glow uppercase mb-2">Administrative Palace</h3>
          <p className="text-xs text-mist-dark">
            Central control chamber for user governance, exercise library operations, and system data management.
          </p>
        </GlowCard>
      </div>
    </div>
  );
}

export default function AdminPanelPage() {
  const { user, login } = useAuth();
  const { settings } = useDisplaySettings();
  const router = useRouter();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const timeZone = settings.timeZone;
  const lt = useCallback((text: string) => translateEnglishToLanguage(text, settings.languageMode), [settings.languageMode]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [recycleBinUsers, setRecycleBinUsers] = useState<RecycleBinUser[]>([]);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalProgressionLogs: 0,
    totalExercises: 0,
    totalCheckIns: 0,
  });
  const [showNewUserModal, setShowNewUserModal] = useState(false);
  const [selectedActivityUserId, setSelectedActivityUserId] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showUserDetailModal, setShowUserDetailModal] = useState(false);
  const [editingName, setEditingName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingFriendRequests, setPendingFriendRequests] = useState<AdminFriendRequest[]>([]);
  const [moderatingRequestId, setModeratingRequestId] = useState<string | null>(null);
  const [recycleBinActionId, setRecycleBinActionId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Check if user is admin based on role
  const isAdmin = user?.role === "admin";

  const fetchData = useCallback(async () => {
    try {
      const [usersData, exercisesData, checkinsData, friendRequestsData, recycleBinData] = await Promise.all([
        api.get<{ users: AdminUser[] }>("/api/users"),
        api.get<{ exercises: unknown[] }>("/api/exercises"),
        api.get<{ checkins: unknown[] }>("/api/checkins"),
        api.get<{ requests: AdminFriendRequest[] }>("/api/admin/friend-requests?status=pending"),
        api.get<{ users: RecycleBinUser[] }>("/api/admin/recycle-bin/users"),
      ]);

      const usersList = usersData.users || [];
      setUsers(usersList);
      const totalLogs = usersList.reduce((sum: number, u: AdminUser) => sum + (u.progressionLogCount ?? 0), 0);
      setStats({
        totalUsers: usersList.length,
        totalProgressionLogs: totalLogs,
        totalExercises: (exercisesData.exercises || []).length,
        totalCheckIns: (checkinsData.checkins || []).length,
      });
      setPendingFriendRequests(friendRequestsData.requests || []);
      setRecycleBinUsers(recycleBinData.users || []);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const moderateFriendRequest = async (requestId: string, status: "accepted" | "rejected") => {
    setModeratingRequestId(requestId);
    try {
      await api.patch("/api/admin/friend-requests", { requestId, status });
      fetchData();
    } catch (err) {
      console.error("Failed to moderate friend request:", err);
    } finally {
      setModeratingRequestId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!selectedActivityUserId && users.length > 0) {
      setSelectedActivityUserId(users[0].id);
    }
  }, [selectedActivityUserId, users]);

  const selectedActivityUser = useMemo(
    () => users.find((entry) => entry.id === selectedActivityUserId) ?? null,
    [selectedActivityUserId, users],
  );

  const firstCreatedAdminId = useMemo(() => {
    const earliestAdmin = users
      .filter((entry) => entry.role === "admin")
      .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")))[0];
    return earliestAdmin?.id ?? null;
  }, [users]);

  const statCards = useMemo<StatCardConfig[]>(() => [
    {
      id: "users",
      label: lt("Total Users"),
      value: stats.totalUsers,
      glow: "jade",
      valueClassName: "text-jade-glow",
    },
    {
      id: "logs",
      label: lt("Training Logs"),
      value: stats.totalProgressionLogs,
      glow: "blue",
      valueClassName: "text-mountain-blue-glow",
    },
    {
      id: "exercises",
      label: lt("Techniques"),
      value: stats.totalExercises,
      glow: "gold",
      valueClassName: "text-gold",
    },
    {
      id: "checkins",
      label: lt("Check-Ins"),
      value: stats.totalCheckIns,
      glow: "crimson",
      valueClassName: "text-crimson-light",
    },
  ], [lt, stats.totalCheckIns, stats.totalExercises, stats.totalProgressionLogs, stats.totalUsers]);

  const userTableColumns = useMemo(() => [
    { id: "username", label: lt("Username"), className: "px-3 py-2 text-left" },
    { id: "name", label: lt("Name"), className: "px-3 py-2 text-left" },
    { id: "type", label: lt("Account Type"), className: "px-3 py-2 text-center" },
    { id: "created", label: lt("Created"), className: "px-3 py-2 text-center" },
    { id: "actions", label: lt("Actions"), className: "px-2 py-2 text-center" },
  ], [lt]);

  const getRoleBadgeClasses = useCallback((role?: string) => {
    if (role === "admin") return "border-gold/40 bg-gold/10 text-gold";
    if (role === "system") return "border-mountain-blue-glow/40 bg-mountain-blue-glow/10 text-mountain-blue-glow";
    return "border-ink-light/40 bg-ink-mid/30 text-mist-light";
  }, []);

  const createUser = async () => {
    if (!newUsername.trim() || !newPassword.trim() || !newName.trim()) return;

    try {
      await api.post("/api/users", {
        username: newUsername,
        password: newPassword,
        name: newName,
      });
      setShowNewUserModal(false);
      setNewUsername("");
      setNewPassword("");
      setNewName("");
      setActionNotice({ type: "success", message: lt("User created successfully.") });
      await fetchData();
    } catch (err) {
      console.error("Failed to create user:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : lt("Failed to create user.") });
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm(lt("Send this user to the recycle bin? Their active records will be removed from the app until restored."))) return;

    try {
      const result = await api.delete<{ message?: string }>(`/api/users/${userId}`);
      setShowUserDetailModal(false);
      setActionNotice({ type: "success", message: result.message || lt("User moved to the recycle bin.") });
      await fetchData();
    } catch (err) {
      console.error("Failed to delete user:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : lt("Failed to move user to the recycle bin.") });
    }
  };

  const updateDisplayName = async (userId: string, newDisplayName: string) => {
    if (!newDisplayName.trim()) return;
    setIsSavingName(true);
    try {
      const data = await api.patch<{ user: { name: string } }>(`/api/users/${userId}`, { name: newDisplayName.trim() });
      if (user && userId === user.id) {
        login({ ...user, name: data.user.name });
      }
      setActionNotice({ type: "success", message: lt("Display name updated.") });
      await fetchData();
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, name: data.user.name });
      }
    } catch (err) {
      console.error("Failed to update display name:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : lt("Failed to update display name.") });
    } finally {
      setIsSavingName(false);
    }
  };

  const resetUserPassword = async (userId: string) => {
    if (resetPassword.length === 0) return;
    if (resetPassword !== resetPasswordConfirm) {
      setActionNotice({ type: "error", message: lt("Password and confirmation do not match.") });
      return;
    }

    setIsResettingPassword(true);
    try {
      await api.patch(`/api/users/${userId}`, { password: resetPassword });
      setActionNotice({
        type: "success",
        message: userId === user?.id
          ? lt("Your password was updated. Use the new password on your next sign-in.")
          : lt("Password updated. Share the new credentials securely."),
      });
      setResetPassword("");
      setResetPasswordConfirm("");
    } catch (err) {
      console.error("Failed to reset user password:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : lt("Failed to update password.") });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: "admin" | "user") => {
    if (userId === user?.id && newRole !== "admin") {
      setActionNotice({ type: "error", message: lt("You cannot remove your own admin privileges.") });
      return;
    }
    setIsUpdatingRole(true);
    try {
      const data = await api.patch<{ user: { role: string } }>(`/api/users/${userId}`, { role: newRole });
      if (user && userId === user.id) {
        login({ ...user, role: data.user.role });
      }
      setActionNotice({ type: "success", message: `${lt("Account type updated to")} ${data.user.role}.` });
      if (selectedUser && selectedUser.id === userId) {
        setSelectedUser({ ...selectedUser, role: data.user.role });
      }
      await fetchData();
    } catch (err) {
      console.error("Failed to update user role:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : lt("Failed to update account type.") });
    } finally {
      setIsUpdatingRole(false);
    }
  };

  const restoreRecycleBinUser = async (archiveId: string) => {
    setRecycleBinActionId(archiveId);
    try {
      const result = await api.post<{ message?: string }>("/api/admin/recycle-bin/users", { archiveId });
      setActionNotice({ type: "success", message: result.message || "User restored from recycle bin." });
      await fetchData();
    } catch (err) {
      console.error("Failed to restore recycle bin user:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to restore user." });
    } finally {
      setRecycleBinActionId(null);
    }
  };

  const permanentlyDeleteRecycleBinUser = async (archiveId: string) => {
    if (!confirm("Permanently delete this archived user? This cannot be undone.")) return;

    setRecycleBinActionId(archiveId);
    try {
      const result = await api.delete<{ message?: string }>("/api/admin/recycle-bin/users", { archiveId, confirm: true });
      setActionNotice({ type: "success", message: result.message || "Archived user permanently deleted." });
      await fetchData();
    } catch (err) {
      console.error("Failed to permanently delete recycle bin user:", err);
      setActionNotice({ type: "error", message: err instanceof Error ? err.message : "Failed to permanently delete archived user." });
    } finally {
      setRecycleBinActionId(null);
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
        <PageSkeleton statCards={4} wideBlock={false} rows={4} />
      ) : (
        <div className="space-y-6">
          {actionNotice ? (
            <div
              className={`rounded-lg border px-3 py-2 text-xs ${actionNotice.type === "success" ? "border-jade-glow/40 bg-jade-deep/10 text-jade-light" : "border-crimson-light/40 bg-crimson-deep/10 text-crimson-light"}`}
            >
              {actionNotice.message}
            </div>
          ) : null}

          <section>
            <h3 className="mb-3 text-sm uppercase text-jade-glow">{lt("System Overview")}</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {statCards.map((card) => (
                <GlowCard key={card.id} glow={card.glow} hoverable={false}>
                  <p className="text-xs uppercase text-mist-dark">{card.label}</p>
                  <p className={`mt-1 text-2xl font-bold ${card.valueClassName}`}>{card.value}</p>
                </GlowCard>
              ))}
            </div>
          </section>

          <GlowCard glow="blue" hoverable={false}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm uppercase tracking-wider text-mountain-blue-glow">{lt("User Activity Log")}</h3>
                <p className="mt-1 text-xs text-mist-dark">{lt("Navigation-based activity powers the friends rail last-activity display.")}</p>
              </div>
              <select
                value={selectedActivityUserId}
                onChange={(event) => setSelectedActivityUserId(event.target.value)}
                className="rounded-md border border-ink-light/60 bg-ink-dark/80 px-2.5 py-2 text-xs text-cloud-white outline-none"
              >
                {users.map((entry) => (
                  <option key={`activity-user-${entry.id}`} value={entry.id}>
                    {entry.name} (@{entry.username})
                  </option>
                ))}
              </select>
            </div>

            {selectedActivityUser ? (
              <div className="space-y-2">
                <div className="rounded-lg border border-ink-light/50 bg-ink-mid/20 p-3">
                  <p className="text-xs uppercase text-mist-dark">{lt("Latest")}</p>
                  <p className="mt-1 text-sm text-cloud-white">{selectedActivityUser.lastActivityLabel || lt("No recent activity")}</p>
                  <p className="mt-1 text-xs text-mist-dark">
                    {selectedActivityUser.lastActivityAt ? formatDateTimeWithPreference(selectedActivityUser.lastActivityAt, dateFormat, timeZone) : lt("Nothing logged yet")}
                  </p>
                </div>

                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {(selectedActivityUser.activityLog || []).length === 0 ? (
                    <p className="text-xs text-mist-dark">{lt("No activity has been logged for this user yet.")}</p>
                  ) : (
                    (selectedActivityUser.activityLog || []).map((entry, index) => (
                      <div key={`activity-entry-${entry.at}-${index}`} className="rounded-lg border border-ink-light/40 bg-ink-dark/30 p-2.5">
                        <p className="text-sm text-cloud-white">{entry.label}</p>
                        <p className="mt-1 text-[11px] text-mist-dark">{formatDateTimeWithPreference(entry.at, dateFormat, timeZone)}</p>
                        <p className="mt-1 text-[10px] text-mountain-blue-glow/80">{entry.route}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-mist-dark">{lt("Select a user to inspect activity.")}</p>
            )}
          </GlowCard>

          <GlowCard glow="jade" hoverable={false}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm uppercase tracking-wider text-jade-glow">{lt("User Management")}</h3>
              <GlowButton variant="jade" size="sm" glow onClick={() => setShowNewUserModal(true)}>
                + {lt("Create User")}
              </GlowButton>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-light">
                    {userTableColumns.map((column) => (
                      <th key={column.id} className={`${column.className} text-xs uppercase text-jade-glow`}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((entry) => (
                    <motion.tr
                      key={entry.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-ink-light/50 transition-colors hover:bg-ink-dark/50"
                    >
                      <td className="px-3 py-2 text-cloud-white">{entry.username}</td>
                      <td className="px-3 py-2 text-mist-light">{entry.name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getRoleBadgeClasses(entry.role)}`}>
                          {entry.role === "admin" ? lt("Admin") : entry.role === "system" ? lt("System") : lt("User")}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-mist-dark">{formatDateWithPreference(entry.createdAt, dateFormat, timeZone)}</td>
                      <td className="px-2 py-2 text-center">
                        <GlowButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(entry);
                            setShowUserDetailModal(true);
                          }}
                        >
                          {lt("View")}
                        </GlowButton>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <GlowCard glow="gold" hoverable={false}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm uppercase tracking-wider text-gold">{lt("Pending Friend Requests")}</h3>
                <span className="text-xs text-mist-dark">{pendingFriendRequests.length} {lt("pending")}</span>
              </div>

              {pendingFriendRequests.length === 0 ? (
                <p className="text-xs text-mist-dark">{lt("No pending friend requests right now.")}</p>
              ) : (
                <div className="space-y-2">
                  {pendingFriendRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between gap-3 rounded-lg border border-ink-light/50 bg-ink-mid/20 p-3">
                      <div>
                        <p className="text-sm text-cloud-white">{request.requester.name} (@{request.requester.username})</p>
                        <p className="text-xs text-mist-dark">{lt("Requested")} {formatDateWithPreference(request.createdAt, dateFormat, timeZone)} {lt("to connect with")} {request.receiver.name}</p>
                      </div>
                      <div className="flex gap-2">
                        <GlowButton
                          variant="jade"
                          size="sm"
                          disabled={moderatingRequestId === request.id}
                          onClick={() => moderateFriendRequest(request.id, "accepted")}
                        >
                          {lt("Approve")}
                        </GlowButton>
                        <GlowButton
                          variant="crimson"
                          size="sm"
                          disabled={moderatingRequestId === request.id}
                          onClick={() => moderateFriendRequest(request.id, "rejected")}
                        >
                          {lt("Reject")}
                        </GlowButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlowCard>

            <GlowCard glow="crimson" hoverable={false}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm uppercase tracking-wider text-crimson-light">{lt("Recycle Bin")}</h3>
                <span className="text-xs text-mist-dark">{recycleBinUsers.length} {lt("archived")}</span>
              </div>

              <p className="mb-3 text-xs text-mist-dark">{lt("Deleted users are removed from the live app and stored here until restored or permanently deleted.")}</p>

              {recycleBinUsers.length === 0 ? (
                <p className="text-xs text-mist-dark">{lt("No deleted users are waiting in the recycle bin.")}</p>
              ) : (
                <div className="space-y-2">
                  {recycleBinUsers.map((entry) => (
                    <div key={entry.archiveId} className="flex items-center justify-between gap-3 rounded-lg border border-ink-light/50 bg-ink-mid/20 p-3">
                      <div>
                        <p className="text-sm text-cloud-white">{entry.name} (@{entry.username})</p>
                        <p className="text-xs text-mist-dark">
                          {lt("Deleted")} {formatDateTimeWithPreference(entry.deletedAt, dateFormat, timeZone)} • {entry.summary.progressionLogCount} {lt("logs")} • {entry.summary.checkInCount} {lt("check-ins")} • {entry.summary.ownedExerciseCount} {lt("owned exercises")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <GlowButton
                          variant="jade"
                          size="sm"
                          disabled={recycleBinActionId === entry.archiveId}
                          onClick={() => restoreRecycleBinUser(entry.archiveId)}
                        >
                          {lt("Restore")}
                        </GlowButton>
                        <GlowButton
                          variant="crimson"
                          size="sm"
                          disabled={recycleBinActionId === entry.archiveId}
                          onClick={() => permanentlyDeleteRecycleBinUser(entry.archiveId)}
                        >
                          {lt("Permanent Delete")}
                        </GlowButton>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlowCard>
          </div>

          <section>
            <h3 className="mb-2 text-sm uppercase text-jade-glow">{lt("Backup Studio & Library Control")}</h3>
            <p className="mb-3 text-xs text-mist-dark">{lt("Manage user backup packages and the shared Application Exercise Library from one admin surface.")}</p>
            <DataManagement />
          </section>
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
          setResetPassword("");
          setResetPasswordConfirm("");
        }}
        title={selectedUser?.name || "User Details"}
        panelClassName="!max-w-2xl"
        contentClassName="max-h-[68vh] overflow-y-auto space-y-3 bg-[color:color-mix(in_srgb,var(--ink-deep)_94%,var(--ink-mid))]"
      >
        {selectedUser && (
          <div className="space-y-3">
            {(() => {
              const isFirstCreatedAdmin = selectedUser.id === firstCreatedAdminId;
              return (
                <>
            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, var(--ink-deep))",
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                <p className="text-xs text-mist-dark uppercase">Username</p>
                <p className="text-sm text-cloud-white mt-1">{selectedUser.username}</p>
                </div>
                <div>
                <p className="text-xs text-mist-dark uppercase">Sessions</p>
                <p className="text-sm text-mountain-blue-glow mt-1">{selectedUser.sessionCount ?? selectedUser.progressionLogCount ?? 0}</p>
                </div>
                <div>
                <p className="text-xs text-mist-dark uppercase">Check-Ins</p>
                <p className="text-sm text-gold mt-1">{selectedUser._count?.checkIns || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-mist-dark uppercase">Member Since</p>
                  <p className="text-sm text-mist-light mt-1">
                    {formatDateWithPreference(selectedUser.createdAt, dateFormat, timeZone)}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 44%, var(--ink-deep))",
              }}
            >
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

            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 44%, var(--ink-deep))",
              }}
            >
              <p className="text-xs text-mist-dark uppercase mb-2">Account Type</p>
              {selectedUser.role === "system" ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-full border border-mountain-blue-glow/40 bg-mountain-blue-glow/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mountain-blue-glow">
                    System
                  </span>
                  <p className="text-[11px] text-mist-dark text-right max-w-[70%]">
                    System accounts (e.g. the Application Exercise Library owner) cannot be reassigned.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex gap-2">
                    {!isFirstCreatedAdmin ? (
                      <GlowButton
                        variant={selectedUser.role === "user" ? "jade" : "ghost"}
                        size="sm"
                        disabled={isUpdatingRole || selectedUser.role === "user" || selectedUser.id === user?.id}
                        onClick={() => updateUserRole(selectedUser.id, "user")}
                      >
                        User
                      </GlowButton>
                    ) : null}
                    <GlowButton
                      variant={selectedUser.role === "admin" ? "jade" : "ghost"}
                      size="sm"
                      disabled={isUpdatingRole || selectedUser.role === "admin"}
                      onClick={() => updateUserRole(selectedUser.id, "admin")}
                    >
                      Admin
                    </GlowButton>
                  </div>
                  <p className="text-[11px] text-mist-dark text-right max-w-[60%]">
                    {isFirstCreatedAdmin
                      ? "The first created admin account cannot be switched to User from this panel."
                      : selectedUser.id === user?.id
                      ? "You cannot remove your own admin privileges. Have another admin demote you if needed."
                      : "Admins have full access to user management and system data."}
                  </p>
                </div>
              )}
            </div>

            <div
              className="rounded-xl border px-3 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 44%, var(--ink-deep))",
              }}
            >
              <p className="text-xs text-mist-dark uppercase mb-2">Reset Password</p>
              <div className="space-y-2">
                <GlowInput
                  type="password"
                  placeholder="New password..."
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <GlowInput
                  type="password"
                  placeholder="Confirm new password..."
                  value={resetPasswordConfirm}
                  onChange={(e) => setResetPasswordConfirm(e.target.value)}
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-mist-dark">
                    {selectedUser.id === user?.id
                      ? "You are resetting your own password. Sign-in sessions stay active until you log out."
                      : "Share the new credentials with the user securely; existing sessions will continue until they sign out."}
                  </p>
                  <GlowButton
                    variant="jade"
                    size="sm"
                    disabled={isResettingPassword || resetPassword.length === 0 || resetPassword !== resetPasswordConfirm}
                    onClick={() => resetUserPassword(selectedUser.id)}
                  >
                    {isResettingPassword ? "..." : "Update"}
                  </GlowButton>
                </div>
              </div>
            </div>

            <div
              className="flex gap-2 rounded-xl border px-3 py-3"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 42%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 44%, var(--ink-deep))",
              }}
            >
              {!isFirstCreatedAdmin ? (
                <GlowButton
                  variant="crimson"
                  size="sm"
                  onClick={() => deleteUser(selectedUser.id)}
                >
                  Send to Recycle Bin
                </GlowButton>
              ) : null}
              <GlowButton variant="ghost" size="sm" onClick={() => setShowUserDetailModal(false)}>
                Close
              </GlowButton>
            </div>
                </>
              );
            })()}
          </div>
        )}
      </GlowModal>
    </PageLayout>
  );
}
