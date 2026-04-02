"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/context/AuthContext";
import { DASHBOARD_ROUTES } from "@/lib/navigation";

const techStack = [
  ["Framework", "Next.js App Router with React client components"],
  ["Runtime", "Node.js server runtime for route handlers and middleware"],
  ["Styling", "Tailwind utilities with themed surface, border, and glow variables"],
  ["Database", "SQLite through Prisma + @prisma/adapter-libsql"],
  ["ORM Client", "Generated Prisma client at src/generated/prisma"],
  ["Auth", "JWT cookie auth with role-based middleware and API wrappers"],
  ["Animation", "Framer Motion for panels, dialogs, and table interactions"],
];

const appModules = [
  ["Authentication & Access", "Cookie-based session auth, role checks, protected admin routes"],
  ["Workout History", "Set logging, per-set metrics, progression completion tracking"],
  ["Exercise Library", "ProgressionExercise CRUD, variants/modifiers, edit-audit timeline"],
  ["Check-In", "Daily attendance and user notes with one-note-per-day guarantees"],
  ["Social", "Friend request lifecycle and user-to-user relationship state"],
  ["Display System", "Theme, panel layout, sidebar placement, nav visibility preferences"],
];

const persistenceSections = {
  database: [
    "User accounts, roles, and friend relationships",
    "Check-ins and per-day check-in notes",
    "Progression exercises, tiers, modifiers, and variations",
    "User progression levels and submitted progression logs",
    "Exercise library edit history audit trail",
  ],
  local: [
    "Workout history table mode, sort, and column order preferences",
    "Workout input draft convenience state for the current browser",
    "Exercise library filters, search, sort, and table mode preferences",
  ],
  memory: [
    "Modal open or closed state",
    "Hover, highlight, and dropdown visibility state",
    "Transient saving, deleting, loading, and error UI flags",
    "Dock open state and current row selection state",
  ],
};

const relationSchema = [
  ["User", "1 -> N", "CheckIn", "User.id -> CheckIn.userId", "No cascade declared in schema"],
  ["User", "1 -> N", "CheckInNote", "User.id -> CheckInNote.userId", "Cascade delete"],
  ["User", "1 -> 1", "UserSettings", "User.id -> UserSettings.userId", "Single settings row per user"],
  ["User", "1 -> N", "FriendRequest (as requester)", "User.id -> FriendRequest.requesterId", "Cascade delete"],
  ["User", "1 -> N", "FriendRequest (as receiver)", "User.id -> FriendRequest.receiverId", "Cascade delete"],
  ["ProgressionExercise", "1 -> N", "ProgressionTier", "ProgressionExercise.id -> ProgressionTier.exerciseId", "Cascade delete"],
  ["ProgressionExercise", "1 -> N", "ProgressionVariation", "ProgressionExercise.id -> ProgressionVariation.exerciseId", "Cascade delete"],
  ["ProgressionExercise", "1 -> N", "ProgressionModifier", "ProgressionExercise.id -> ProgressionModifier.exerciseId", "Cascade delete"],
  ["ProgressionExercise", "1 -> N", "UserProgressionLevel", "ProgressionExercise.id -> UserProgressionLevel.exerciseId", "Cascade delete"],
  ["UserProgressionLevel", "1 -> N", "ProgressionLog", "UserProgressionLevel.id -> ProgressionLog.userProgressionId", "Cascade delete"],
];

const tableDictionary = [
  ["User", "Identity", "id", "username (unique), friendCode (unique), role, createdAt, updatedAt"],
  ["FriendRequest", "Social", "id", "requesterId, receiverId, status, createdAt, respondedAt"],
  ["UserSettings", "Preferences", "id", "userId (unique), dualPageView, panelPosition, pinnedNavItems"],
  ["CheckIn", "Attendance", "id", "date, userId, present, weight, comment, createdAt"],
  ["CheckInNote", "Attendance Notes", "id", "date (YYYY-MM-DD), userId, content, pinned, updatedAt"],
  ["Exercise", "Legacy Catalog", "id", "name, wuxiaName, difficulty, type, assignedDays"],
  ["ProgressionExercise", "Progression Catalog", "id", "name, category, equipmentType, muscles, prerequisites JSON, cues JSON"],
  ["ProgressionTier", "Progression Levels", "id", "exerciseId, level, name, targetReps, targetHold"],
  ["ProgressionVariation", "Variants", "id", "exerciseId, name, wuxia metadata, description"],
  ["ProgressionModifier", "Modifiers", "id", "exerciseId, type, available, difficultyMod, method"],
  ["UserProgressionLevel", "User State", "id", "userId, exerciseId, currentLevel, updatedAt"],
  ["ProgressionLog", "Workout Logs", "id", "userProgressionId, level, set metrics, hold times, notes, completed"],
  ["ExerciseEditHistory*", "Audit Trail", "id", "exerciseId, field, beforeValue, afterValue, editedAt"],
];

const indexHighlights = [
  ["User", "@unique", "username, friendCode", "Fast account lookup and invite/friend-code joins"],
  ["FriendRequest", "@@unique + @@index", "[requesterId, receiverId], requesterId, receiverId, status", "Prevents duplicate active pairs and supports inbox queries"],
  ["CheckIn", "@@unique + @@index", "[date, userId], userId", "Guarantees one check-in row per user/day"],
  ["CheckInNote", "@@unique + @@index", "[date, userId], userId", "Guarantees one note per user/date"],
  ["ProgressionExercise", "@@index", "userId", "Supports exercise listing and owner-scoped querying"],
  ["ProgressionTier", "@@index", "exerciseId", "Efficient tier loading per exercise"],
  ["ProgressionVariation", "@@index", "exerciseId", "Efficient variant loading per exercise"],
  ["ProgressionModifier", "@@index", "exerciseId", "Efficient modifier loading per exercise"],
  ["UserProgressionLevel", "@@unique + @@index", "[userId, exerciseId], userId, exerciseId", "Single current state per user/exercise"],
  ["ProgressionLog", "@@index", "userProgressionId", "Efficient history fetch by user progression chain"],
  ["ExerciseEditHistory*", "SQL index", "editedAt DESC, exerciseId", "Recent-first audit browsing and exercise filtering"],
];

const databaseModels = [
  {
    title: "Identity & Social",
    items: [
      "User: account profile, role, timestamps",
      "FriendRequest: requester, receiver, status, response tracking",
      "UserSettings: nav and panel preferences stored server-side",
    ],
  },
  {
    title: "Check-In System",
    items: [
      "CheckIn: attendance, weight, comment, presence by day",
      "CheckInNote: one pinned note per user per date",
    ],
  },
  {
    title: "Legacy Exercise Catalog",
    items: [
      "Exercise: older exercise reference records with name, difficulty, type, and assignment days",
    ],
  },
  {
    title: "Progression Module",
    items: [
      "ProgressionExercise: main exercise entity with muscles, category, equipment, and metadata",
      "ProgressionTier: level targets and descriptions per exercise",
      "ProgressionVariation: persisted exercise variants",
      "ProgressionModifier: available modifiers and difficulty adjustments",
      "UserProgressionLevel: current level per user per exercise",
      "ProgressionLog: submitted set data, modifier, variant, notes, and completion status",
    ],
  },
  {
    title: "Audit Tables",
    items: [
      "ExerciseEditHistory: raw SQL-backed audit log for exercise library mutations",
    ],
  },
];

const keyFlows = [
  {
    title: "Workout History",
    body: "Training log submissions write to progression log tables. View preferences remain browser-local, while submitted sets and history remain database-backed.",
  },
  {
    title: "Exercise Library",
    body: "Exercise entities, variants, and edit history are persisted in the database. Search, filters, sorting, and open-mode layout are local per user.",
  },
  {
    title: "Admin Access",
    body: "Admin-only pages are protected in middleware and also guarded in-page via the authenticated user role.",
  },
  {
    title: "Audit Trail",
    body: "Exercise library edits are appended to ExerciseEditHistory with actor, field, before/after values, and timestamp. Missing legacy records are backfilled with seeded Created entries.",
  },
  {
    title: "Schema Evolution",
    body: "Prisma migrations under prisma/migrations evolve core schema over time, while ExerciseEditHistory is created and indexed dynamically through SQL in the API route.",
  },
];

export default function WebsiteInformationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  const totalModelCount = useMemo(
    () => databaseModels.reduce((count, section) => count + section.items.length, 0),
    [],
  );

  if (!user || !isAdmin) {
    return (
      <PageLayout
        title="Website Information"
        subtitle="Architecture, persistence, and data model reference"
      >
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="text-5xl opacity-50">🔒</div>
          <h3 className="text-lg font-semibold text-crimson-light">Access Restricted</h3>
          <p className="text-sm text-mist-dark text-center max-w-md">
            Website Information is available only to admins because it documents system internals, persistence boundaries, and database structure.
          </p>
          <GlowButton variant="ghost" size="sm" onClick={() => router.push(DASHBOARD_ROUTES.overview)}>
            ← Return to Overview
          </GlowButton>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Website Information"
      subtitle="Architecture, persistence boundaries, and database reference"
      contentWidth="fluid"
      contentMaxWidthClass="max-w-none"
    >
      <div className="nyaa-history-page space-y-3 px-0 py-2 sm:py-3">
        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>System Summary</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>Core Product Areas:</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>{appModules.length}</td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>Persistence Layers:</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>3</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Documented Models:</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>{totalModelCount}</td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Access:</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--crimson-light)" }}>Admin-only</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Schema Entities:</td>
                <td className="px-2 py-1.5 border-b border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{relationSchema.length + 3}</td>
                <td className="px-2 py-1.5 font-semibold border-b border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Relation Edges:</td>
                <td className="px-2 py-1.5 border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{relationSchema.length}</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))" }}>Purpose:</td>
                <td className="px-2 py-1.5" colSpan={3} style={{ color: "var(--text-primary)" }}>
                  Internal reference for architecture, persistence boundaries, and database structure.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Website Overview</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <tbody>
              {techStack.map(([label, value], idx) => (
                <tr key={label}>
                  <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>{label}:</td>
                  <td className={`px-2 py-1.5 ${idx < techStack.length - 1 ? "border-b" : ""}`} style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Application Modules</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", width: "28%" }}>Module</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Responsibility</th>
              </tr>
            </thead>
            <tbody>
              {appModules.map(([module, responsibility], idx) => (
                <tr key={module} className={idx < appModules.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>{module}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{responsibility}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Persistence Boundaries</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)", width: "18%" }}>Layer</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>Scope</th>
              </tr>
            </thead>
            <tbody>
              {[...
                persistenceSections.database.map((item) => ["Database", item] as const),
                ...persistenceSections.local.map((item) => ["Local", item] as const),
                ...persistenceSections.memory.map((item) => ["Memory", item] as const),
              ].map(([layer, scope], idx, arr) => (
                <tr key={`${layer}-${scope}`} className={idx < arr.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r whitespace-nowrap" style={{ borderColor: "var(--border)", color: layer === "Database" ? "var(--accent)" : layer === "Local" ? "var(--gold)" : "var(--crimson-light)", fontWeight: 600 }}>{layer}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{scope}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Database Structure</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)", width: "24%" }}>Domain</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}>Models</th>
              </tr>
            </thead>
            <tbody>
              {databaseModels.map((section, idx) => (
                <tr key={section.title} className={idx < databaseModels.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>{section.title}</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Database Schematics (Relationship Map)</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "14%", color: "var(--text-secondary)" }}>Source</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "10%", color: "var(--text-secondary)" }}>Cardinality</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "18%", color: "var(--text-secondary)" }}>Target</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "26%", color: "var(--text-secondary)" }}>Join Key</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Deletion / Constraint Notes</th>
              </tr>
            </thead>
            <tbody>
              {relationSchema.map(([source, cardinality, target, joinKey, notes], idx) => (
                <tr key={`${source}-${target}-${joinKey}`} className={idx < relationSchema.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>{source}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>{cardinality}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{target}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{joinKey}</td>
                  <td className="px-2 py-1.5 align-top" style={{ color: "var(--text-primary)" }}>{notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Table Dictionary (Detailed)</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "17%", color: "var(--text-secondary)" }}>Table</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "14%", color: "var(--text-secondary)" }}>Domain</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "8%", color: "var(--text-secondary)" }}>PK</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Operational Fields</th>
              </tr>
            </thead>
            <tbody>
              {tableDictionary.map(([table, domain, pk, fields], idx) => (
                <tr key={`${table}-${domain}`} className={idx < tableDictionary.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>{table}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{domain}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>{pk}</td>
                  <td className="px-2 py-1.5 align-top" style={{ color: "var(--text-primary)" }}>{fields}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Index & Constraint Strategy</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "15%", color: "var(--text-secondary)" }}>Table</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "16%", color: "var(--text-secondary)" }}>Constraint Type</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "30%", color: "var(--text-secondary)" }}>Columns</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Operational Purpose</th>
              </tr>
            </thead>
            <tbody>
              {indexHighlights.map(([table, type, columns, purpose], idx) => (
                <tr key={`${table}-${columns}`} className={idx < indexHighlights.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>{table}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>{type}</td>
                  <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>{columns}</td>
                  <td className="px-2 py-1.5 align-top" style={{ color: "var(--text-primary)" }}>{purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Raw SQL Managed Tables</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "20%", color: "var(--text-secondary)" }}>Table</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "34%", color: "var(--text-secondary)" }}>Columns</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "22%", color: "var(--text-secondary)" }}>Indexes</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>ExerciseEditHistory</td>
                <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>id, exerciseId, exerciseName, userId, userName, field, beforeValue, afterValue, editedAt</td>
                <td className="px-2 py-1.5 border-r align-top" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>idx_exercise_edit_history_editedAt, idx_exercise_edit_history_exerciseId</td>
                <td className="px-2 py-1.5 align-top" style={{ color: "var(--text-primary)" }}>Created in API runtime (CREATE TABLE IF NOT EXISTS) to keep audit logging resilient even if migration ordering differs.</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Key System Flows</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <tbody>
              {keyFlows.map((flow, idx) => (
                <tr key={flow.title} className={idx < keyFlows.length - 1 ? "border-b" : ""} style={{ borderColor: "var(--border)" }}>
                  <td className="px-2 py-1.5 font-semibold border-r whitespace-nowrap align-top" style={{ borderColor: "var(--border)", color: "var(--text-muted)", backgroundColor: "color-mix(in srgb, var(--border) 10%, var(--surface))", width: "22%" }}>{flow.title}:</td>
                  <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>{flow.body}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
            <span className="text-xs font-bold" style={{ color: "var(--text-primary)" }}>Data Lifecycle & Ownership</span>
          </div>
          <table className="w-full text-[11px] border-collapse" style={{ backgroundColor: "var(--surface)" }}>
            <thead>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "20%", color: "var(--text-secondary)" }}>Data Type</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "15%", color: "var(--text-secondary)" }}>Owner</th>
                <th className="text-left px-2 py-1 font-semibold border-r" style={{ borderColor: "var(--border)", width: "18%", color: "var(--text-secondary)" }}>Persistence</th>
                <th className="text-left px-2 py-1 font-semibold" style={{ color: "var(--text-secondary)" }}>Retention Rule</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>Progression logs</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Database</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>Persistent</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>Retained as workout history; only removed if parent records are deleted via cascading relationships.</td>
              </tr>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>Exercise metadata (tiers, variants, modifiers)</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Database</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>Persistent</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>Retained until exercise deletion; child rows cascade from parent exercise.</td>
              </tr>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>Edit-history timeline</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Database (SQL table)</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--accent)" }}>Persistent</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>Appended event log with seeded Created rows for historical completeness.</td>
              </tr>
              <tr className="border-b" style={{ borderColor: "var(--border)" }}>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>UI view preferences</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>Browser local storage</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--gold)" }}>Local</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>Persists in the current browser profile and user-scoped key namespace.</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)", fontWeight: 600 }}>Temporary UI state</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>React state</td>
                <td className="px-2 py-1.5 border-r" style={{ borderColor: "var(--border)", color: "var(--crimson-light)" }}>Memory only</td>
                <td className="px-2 py-1.5" style={{ color: "var(--text-primary)" }}>Discarded on reload/navigation unless mirrored into local storage or API writes.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}