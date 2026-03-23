# Comprehensive Codebase Analysis Report — Cultivation Workout (修炼之路)

**Generated:** March 23, 2026  
**Version:** 2.2.5  
**Purpose:** Full codebase audit for AI assistant consultation  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Performance & Efficiency Issues](#2-performance--efficiency-issues)
3. [UI/UX Design Problems](#3-uiux-design-problems)
4. [Responsive Design Analysis](#4-responsive-design-analysis)
5. [Code Quality](#5-code-quality)
6. [Security Issues](#6-security-issues)
7. [File Size Summary](#7-file-size-summary)
8. [Recommended Priority Actions](#8-recommended-priority-actions)

---

## 1. Project Overview

### 1.1 Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 16.1.6 |
| **Language** | TypeScript | ^5 |
| **UI Library** | React | 19.2.3 |
| **Styling** | Tailwind CSS v4 + Custom CSS | ^4 |
| **Animation** | Framer Motion | ^12.34.3 |
| **Database** | SQLite via libSQL | — |
| **ORM** | Prisma | ^7.4.1 |
| **Auth** | Custom (bcryptjs) — no JWT/session tokens | ^3.0.3 |
| **Mobile** | Capacitor (Android APK) | ^8.2.0 |
| **Deployment** | Docker (standalone build) | — |
| **Spreadsheet** | xlsx.js for import/export | ^0.18.5 |

### 1.2 Project Structure & Architecture

```
src/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout (7 Google Fonts loaded)
│   ├── page.tsx                  # Login page (~280 lines)
│   ├── globals.css               # 1,500+ lines of CSS
│   ├── api/                      # 28 API route files
│   │   ├── auth/                 # login, register, logout
│   │   ├── users/                # user CRUD, preferences
│   │   ├── exercises/            # exercise CRUD, history
│   │   ├── exercise-library/     # curated exercise library
│   │   ├── progressions/         # progression tracking, logs, import/export
│   │   ├── checkins/             # attendance, notes, weight
│   │   ├── weight-standards/     # tier weight standards
│   │   └── admin/                # admin operations (import, export, standards)
│   └── dashboard/
│       ├── page.tsx              # Main dashboard (~1,350 lines)
│       ├── layout.tsx            # Dashboard shell with nav
│       ├── workout/page.tsx      # Training system (**3,443 lines**)
│       ├── exercise-library/     # Exercise CRUD page (~1,200)
│       ├── settings/page.tsx     # Settings page (~1,200)
│       ├── checkin/page.tsx      # Check-in page (~1,000)
│       ├── admin/                # Admin & weight standards pages
│       └── mobile/               # 5 mobile-specific pages
├── components/                   # ~48 component files
│   ├── ui/                       # GlowButton, GlowInput, GlowCard, SetupWizard, PresetSlots
│   ├── navigation/               # TopBar, LeftSidebar, BottomBar, RightPanel, SwipeNavigation
│   ├── workout/                  # UnifiedTrainingLogTable (1,319), TrainingSidebar, etc.
│   ├── mobile/                   # 25 files across 9 subdirectories
│   ├── admin/                    # DataManagement (~700)
│   ├── analytics/                # ExerciseCharts (~500)
│   ├── layout/                   # PageLayout (~400)
│   └── system/                   # ConnectivityBanner
├── context/                      # AppContext, AuthContext, DisplaySettingsContext
├── hooks/                        # 8 custom hooks (mobile gestures, haptics, etc.)
├── lib/                          # Utilities, constants, analytics
├── providers/                    # BackButton, Haptic, SystemBars providers
├── styles/                       # mobile.css (10 lines)
└── utils/                        # Color conversion, haptics, animations
```

**Architecture Pattern:** Monolithic client-side SPA with REST API routes. No middleware. No shared state management library (all React Context + useState). Authentication is entirely client-side (localStorage).

### 1.3 Entry Points & Main Components

| Entry Point | File | Purpose |
|-------------|------|---------|
| Root Layout | `src/app/layout.tsx` | Loads 7 Google Fonts, AuthProvider, theme scripts |
| Login | `src/app/page.tsx` | Username/password auth with "Remember Me" |
| Dashboard Shell | `src/app/dashboard/layout.tsx` | Nav layout (TopBar, Sidebar, BottomBar, Panels) |
| Main Dashboard | `src/app/dashboard/page.tsx` | Calendar, check-ins, sect register, notes |
| Training | `src/app/dashboard/workout/page.tsx` | Core exercise progression system |
| Exercise Library | `src/app/dashboard/exercise-library/page.tsx` | Exercise CRUD with filtering |
| Settings | `src/app/dashboard/settings/page.tsx` | Theme, display, layout preferences |
| Admin | `src/app/dashboard/admin/page.tsx` | User management, data tools |

### 1.4 Database Schema (11 models)

- `User` — auth + profile
- `UserSettings` — UI preferences (stored as JSON strings in text fields)
- `CheckIn` — daily attendance with weight
- `CheckInNote` — pinned notes per day
- `Exercise` — simplified exercise catalog
- `ProgressionExercise` — detailed exercise with tiers/variations/modifiers
- `ProgressionTier` — numbered skill levels per exercise
- `ProgressionVariation` — exercise variants
- `ProgressionModifier` — equipment/difficulty modifiers
- `UserProgressionLevel` — user's current level per exercise
- `ProgressionLog` — workout log entries (3 sets: weight1-3, reps1-3, holdTime1-3)
- `WeightStandard` — 6-tier weight standards per exercise per gender

---

## 2. Performance & Efficiency Issues

### 2.1 Oversized Component Files (Critical)

These files are far too large and need decomposition:

| File | Lines | Responsibility Overload |
|------|-------|------------------------|
| `src/app/dashboard/workout/page.tsx` | **3,443** | Exercise progression, tier management, modifier parsing, band logic, weight standards, table rendering, modals |
| `src/app/dashboard/page.tsx` | **1,350** | Calendar, check-ins, sect register, notes, color customization, weight prompts, modals |
| `src/components/workout/UnifiedTrainingLogTable.tsx` | **1,319** | 21 helper functions + 828-line React component, tier calculation, modifier parsing, 2 portals |
| `src/app/dashboard/exercise-library/page.tsx` | **~1,200** | Exercise CRUD + inline modals + filtering |
| `src/app/dashboard/settings/page.tsx` | **~1,200** | 5+ settings sections all in one component |
| `src/app/dashboard/checkin/page.tsx` | **~1,000** | Edit mode snapshot logic, community notes |

### 2.2 Unnecessary Re-renders

**`src/components/workout/UnifiedTrainingLogTable.tsx` Lines ~800-950:**
```tsx
// Each row recalculates tier info, glow styles inline — triggers re-render on any state change
{entries.map((entry) => {
  const ex = exerciseLookup.get(entry.exerciseId);
  // 150+ lines of inline JSX per row with calculations
})}
```
- **Fix:** Extract a memoized `<TableRow>` component; move calculations into `useMemo`.

**`src/app/dashboard/page.tsx`:**
- 19 `useState` calls in one component — any state change re-renders the entire 1,350-line component
- Derived state (`filteredCheckInRows`) calculated on every render instead of using `useMemo`
- Handler functions (`handleSaveCheckIn`, `proceedWithSaveCheckIn`) recreated on every render without `useCallback`

**`src/components/navigation/TopBar.tsx`:**
- `useWindowSize()` hook triggers resize listener on every render cycle

### 2.3 Missing Data Caching & Redundant API Calls

**`src/components/system/ConnectivityBanner.tsx` Line ~30:**
```tsx
// Pings /api/checkins every 30 seconds just to test connectivity
const res = await fetch("/api/checkins?...", { signal });
```
- **Fix:** Create a dedicated `/api/health` endpoint instead of querying real data.

**`src/app/dashboard/page.tsx` Lines ~594-650:**
```tsx
// Fetches ALL users, ALL checkins, ALL exercises, ALL future notes on every month change
const [checkinsRes, usersRes, exerciseRes, futureNotesRes] = await Promise.all([
  fetch(`/api/checkins?...`),
  fetch("/api/users"),
  fetch("/api/exercises"),
  fetch("/api/checkins/notes?future=true"),
]);
```
- No client-side caching; full refetch on every navigation back to dashboard.
- **Fix:** Implement SWR or React Query for data caching.

**No caching headers on API routes:**
- All API routes return data without `Cache-Control` headers
- `cache: "no-store"` used inconsistently across fetch calls

### 2.4 N+1 Query Problems & Database Inefficiencies

**`src/app/api/progressions/logs/import/route.ts` — Critical N+1:**
```tsx
// For EACH of up to 10,000 logs:
for (const rawLog of logs) {
  // 1. Look up exercise (OK — in-memory map)
  // 2. ensureTierExists() → potential DB CREATE per log
  // 3. ensureVariationExists() → potential DB CREATE per log
  // 4. ensureUserProgressionLevel() → potential DB CREATE per log
  // 5. prisma.progressionLog.create() → 1 DB INSERT per log
}
```
- **Worst case:** 10,000 logs × 4 DB calls = **40,000 sequential database operations**
- **Fix:** Batch `createMany` operations, collect unique tiers/variations first.

**`src/app/api/admin/exercise-library/import/route.ts`:**
```tsx
// Per exercise: 1 exercise create + tiers createMany + variations createMany + 
// modifiers createMany + userLevel create = ~5 DB operations per exercise
```
- Importing 100 exercises = ~500+ DB operations

**`src/app/api/exercises/route.ts` POST — Inefficient duplicate check:**
```tsx
// Fetches ALL exercises then filters in JavaScript for case-insensitive matching
// because SQLite doesn't support mode:"insensitive"
const allExercises = await prisma.exercise.findMany();
const duplicate = allExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
```
- **Fix:** Use SQLite `COLLATE NOCASE` or add a normalized name column.

**`src/app/api/users/route.ts` — Manual aggregation:**
```tsx
// Fetches ALL UserProgressionLevels with log counts, then manually aggregates
const progressionLevels = await prisma.userProgressionLevel.findMany({
  select: { userId: true, _count: { select: { logs: true } } },
});
const progressionLogCounts = new Map<string, number>();
for (const level of progressionLevels) {
  progressionLogCounts.set(level.userId, (progressionLogCounts.get(level.userId) ?? 0) + level._count.logs);
}
```
- **Fix:** Use Prisma `groupBy` or raw SQL aggregation.

### 2.5 Large Bundle Size Concerns

**`src/app/layout.tsx` — 7 Google Fonts loaded on every page:**
```tsx
import { Geist, Geist_Mono, Roboto, Cinzel, Noto_Serif, Crimson_Text, Ma_Shan_Zheng } from "next/font/google";
```
- Each font adds to the initial page weight. Ma Shan Zheng (Chinese calligraphy) is a large font.
- **Fix:** Lazy-load decorative fonts; only load essential fonts initially.

**`src/app/globals.css` — 1,500+ lines:**
- ~550 lines of APK-specific density CSS overrides
- Theme definitions repeated 3 times (~120 lines each for mountain-mist, calligraphy, sakura)
- **Fix:** Split into modular CSS files; use CSS custom property inheritance to reduce duplication.

**`xlsx` library imported for spreadsheet operations:**
- Full xlsx library (~1MB) imported for import/export features used by admins only
- **Fix:** Dynamic import via `next/dynamic` or `import()` only when needed.

### 2.6 Synchronous Operations That Should Be Async

**`src/app/page.tsx` Lines ~35-50 — localStorage reads in render:**
```tsx
useEffect(() => {
  try {
    const saved = localStorage.getItem(REMEMBERED_CREDENTIALS_KEY);
    if (saved) {
      const { username: savedUser, password: savedPass } = JSON.parse(saved);
      // ...
    }
  } catch {}
}, []);
```
- **Security concern:** Storing plain-text passwords in localStorage (see Security section).

**`src/context/AppContext.tsx` — Multiple localStorage reads in effects:**
- Navigation state, theme, theme style all read from localStorage synchronously on mount
- Multiple `document.documentElement.classList` mutations in sequence

---

## 3. UI/UX Design Problems

### 3.1 Accessibility Issues (WCAG Non-Compliance)

**Missing ARIA Labels Throughout:**

| Component | File | Issue |
|-----------|------|-------|
| GlowButton | `src/components/ui/GlowButton.tsx` | No `aria-label` on icon-only variants |
| TopBar collapse button | `src/components/navigation/TopBar.tsx` | Pulse button has no accessible name |
| BottomBar menu items | `src/components/navigation/BottomBar.tsx` | Generic `onClick` buttons, no `role="menuitem"` |
| RightPanel toggle | `src/components/navigation/RightPanel.tsx` | Missing `aria-expanded`, `aria-controls` |
| TrainingSidebar cards | `src/components/workout/TrainingSidebar.tsx` | Click handlers on `<div>`, no keyboard nav |
| MobileProgressRing | `src/components/mobile/progress/MobileProgressRing.tsx` | SVG missing `aria-valuenow`, `aria-label` |
| MobileBottomNav | `src/components/mobile/navigation/MobileBottomNav.tsx` | Missing `aria-current="page"` on active tab |

**Missing Focus Management:**
- No focus trap in modals (except GlowModal which uses `createPortal`)
- MobileModal (`src/components/mobile/layout/MobileModal.tsx`) has no `aria-modal` or focus trap
- No visible focus rings documented for keyboard users
- Custom dropdowns in DisplaySettingsPopup lack arrow key navigation

**Color Contrast Concerns:**
- `text-mist-dark` on `bg-ink-dark/50` — likely below WCAG AA 4.5:1 ratio
- Glow effects are purely visual — no alternative indicator for color-blind users

### 3.2 Missing Loading, Error, and Empty States

| Page/Component | Loading State | Error State | Empty State |
|----------------|:------------:|:-----------:|:-----------:|
| Dashboard (`page.tsx`) | Spinner ✅ | Console only ❌ | No ❌ |
| Workout (`workout/page.tsx`) | Partial ⚠️ | Console only ❌ | No ❌ |
| Exercise Library | Partial ⚠️ | Generic message ⚠️ | No ❌ |
| Settings | None ❌ | None ❌ | N/A |
| Check-in | Partial ⚠️ | Console only ❌ | No ❌ |
| UnifiedTrainingLogTable | None ❌ | None ❌ | No ❌ |
| RightPanel stats | None ❌ | None ❌ | No ❌ |
| ExerciseCharts | None ❌ | None ❌ | No ❌ |

**Specific examples:**

**`src/app/dashboard/page.tsx` Line ~607:**
```tsx
const [checkinsRes, usersRes, exerciseRes, futureNotesRes] = await Promise.all([...]);
// If ANY fetch fails, entire page silently fails — errors only logged to console
```

**`src/components/workout/UnifiedTrainingLogTable.tsx`:**
- No loading skeleton during initial render
- No error boundary for failed tier calculations
- Save operations show message briefly but no persistent indicator

### 3.3 Inconsistent Button Styles

- `GlowButton` provides 5 variants: `jade`, `crimson`, `gold`, `blue`, `ghost`
- But many components create custom buttons with inline Tailwind instead:
  - `src/app/dashboard/page.tsx`: Multiple `<button className="px-3 py-1 rounded text-xs ...">` patterns
  - `src/app/dashboard/checkin/page.tsx`: Custom styled buttons not using GlowButton
  - `src/components/admin/DataManagement.tsx`: File upload input with inconsistent styling
- **Fix:** Enforce GlowButton usage for all interactive elements.

### 3.4 Component Hierarchy Issues

- `src/app/dashboard/workout/page.tsx` renders everything in one 3,443-line component
- Modals, drawers, tables, sidebars, and forms all coexist in the same component tree
- No clear separation between data-fetching layer and presentation layer
- `src/context/AppContext.tsx` mixes UI state (collapsed, mobileSidebarOpen) with user preferences (theme, themeStyle) and remote sync logic

---

## 4. Responsive Design Analysis

### 4.1 Breakpoints Used

| Breakpoint | Where Used | Purpose |
|------------|-----------|---------|
| `768px` | `AppContext.tsx`, dashboard layout | Mobile/desktop threshold |
| `1024px` | Settings, workout pages | Compact desktop mode |
| `sm:` (640px) | Exercise library grid | Grid column changes |
| `md:` (768px) | Various grid layouts | 2-column → multi-column |
| `lg:` (1024px) | Some flex layouts | Sidebar visibility |

**Missing Breakpoints:**
- No `xl` (1280px) or `2xl` (1536px) breakpoints — large monitors get same layout as 1024px
- No breakpoints between 768px and 1024px (tablet portrait)

### 4.2 Components That Break on Mobile

**`src/app/dashboard/workout/page.tsx`:**
- Training log table has many columns (Date, Category, Exercise, Tier, Sets 1-3, Modifier, etc.)
- No horizontal scroll wrapper on mobile
- Column visibility toggles exist but default state may show too many columns
- Complex modal layouts (tier editor, modifier selector) not optimized for small screens

**`src/components/workout/UnifiedTrainingLogTable.tsx`:**
- Table renders with full desktop column set
- No responsive column collapsing
- Inline expansion of tiers/modifiers causes horizontal overflow

**`src/app/dashboard/exercise-library/page.tsx`:**
- Dense grid layout with `sm:grid-cols-[...]` but content is very dense
- Action dropdown menus may be hard to tap on mobile
- Filter/search bar takes full width but button alignment may break

### 4.3 Fixed Widths Causing Horizontal Scroll

**`src/app/layout.tsx` Lines ~80-90 — Browser viewport override:**
```tsx
// Forces desktop width=1280 in browser mode
dangerouslySetInnerHTML={{
  __html: `...vp.setAttribute('content','width=1280,initial-scale=0.25,user-scalable=yes')...`
}}
```
- In browser mode, viewport is forced to 1280px width at 0.25x scale
- This means mobile browsers see a zoomed-out desktop view, not a responsive mobile view
- Only the Capacitor APK gets proper mobile viewport
- **Impact:** Browser users on phones/tablets cannot get a mobile-responsive experience

### 4.4 Touch Targets Too Small for Mobile

**`src/components/navigation/BottomBar.tsx`:**
- FAB menu items use `text-xs` sizing — may be below 44px minimum touch target

**`src/app/dashboard/page.tsx` — Sect Register:**
- Check-in toggle checkboxes in table cells are small
- Date cells in calendar may be too compact on mobile

**`src/components/workout/UnifiedTrainingLogTable.tsx`:**
- Weight/reps input fields in table cells are very compact
- Delete/edit buttons per row use icon-only patterns

### 4.5 Images/Media Not Responsive

- No `<img>` tags or media elements were found in the codebase
- All visual elements are CSS/SVG-based (glows, gradients, progress rings)
- SVG progress ring in `MobileProgressRing.tsx` uses fixed dimensions — could use `viewBox` more effectively

### 4.6 Navigation Adaptation

| Navigation Element | Desktop | Mobile (APK) | Mobile (Browser) |
|-------------------|---------|-------------|-----------------|
| TopBar | Visible with tabs | Hidden (collapsed) | Hidden (forced 1280px) |
| LeftSidebar | Draggable nav items | Hidden | Hidden (forced 1280px) |
| BottomBar | Hidden | FAB + expanded menu | Hidden (forced 1280px) |
| FloatingMobileSidebar | Hidden | Slide-in from left | Hidden |
| SwipeNavigation | Disabled | Edge swipe (40px) | Disabled |

**Issue:** Mobile browser users get zero mobile navigation — they see a zoomed-out desktop UI. Only APK users get mobile navigation.

---

## 5. Code Quality

### 5.1 Code Duplication

**Pattern 1: API Fetch + Error Handling (repeated ~30+ times):**
```tsx
// This pattern appears in almost every page and component
const res = await fetch("/api/some-endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
if (!res.ok) { /* handle error */ }
const result = await res.json();
```
- **Fix:** Create an `apiClient` utility with typed methods.

**Pattern 2: Admin Role Check (repeated in 6+ API routes):**
```tsx
// src/app/api/admin/weight-standards/route.ts (and similar)
const userId = params.get("userId");
const user = await prisma.user.findUnique({ where: { id: userId } });
if (!user || user.role !== "admin") {
  return NextResponse.json({ error: "Admin access required" }, { status: 403 });
}
```
- **Fix:** Create middleware or a `requireAdmin(req)` utility function.

**Pattern 3: Case-Insensitive Duplicate Check (repeated in 5+ routes):**
```tsx
// Fetches ALL records then filters in JS due to SQLite limitation
const allExercises = await prisma.exercise.findMany();
const duplicate = allExercises.find(e => e.name.toLowerCase() === name.toLowerCase());
```
- **Fix:** Add a `nameLower` column or use SQLite `COLLATE NOCASE`.

**Pattern 4: Modal Component Inline (repeated in 4+ pages):**
- Each page defines its own modal JSX instead of using shared modal components
- ExerciseModal, WeightStandardsModal, UserDetailModal all follow the same pattern

**Pattern 5: Theme Class List (repeated in 3+ places):**
```tsx
const themes = ["midnight-ink", "mountain-mist", "calligraphy", "sakura", "sakura-dark"];
document.documentElement.classList.remove(...themes);
```
- This array appears in `layout.tsx`, `page.tsx`, `AppContext.tsx`

### 5.2 Overly Complex Functions

**`src/app/dashboard/workout/page.tsx` — entire file (3,443 lines):**
- Contains type definitions, helper functions, state management, data fetching, UI rendering, and modal logic all in one file
- Should be decomposed into at minimum:
  - `types/workout.ts` — TypeScript interfaces
  - `lib/modifier-parser.ts` — Band/modifier parsing utilities
  - `components/workout/TrainingTable.tsx` — Table component
  - `components/workout/TierEditor.tsx` — Tier editing modal
  - `hooks/useWorkoutData.ts` — Data fetching logic

**`src/lib/exercise-analytics.ts` `buildExerciseAnalytics()` Lines ~211-530 (319 lines):**
- Computes: sorting, tier stats, linear regression, streak detection, fatigue scoring, plateau detection, 8 breakdown aggregations
- All in a single function
- **Fix:** Extract into composable analytics functions.

**`src/components/workout/UnifiedTrainingLogTable.tsx` main component (828 lines):**
- 21 helper functions at module level
- Complex conditional rendering with 10+ visibility flags
- Two `createPortal` calls for modals
- No row-level memoization

### 5.3 Missing Error Handling

**API Routes — No global error wrapper:**
- Each of 28 API routes implements its own try/catch
- Some log to `console.error` which may expose stack traces in production
- No structured error response format (some return `{ error: string }`, others `{ message: string }`)

**Client-Side — Silent failures:**

`src/app/dashboard/page.tsx` Line ~415:
```tsx
// Weight sync fetch — error silently caught
fetch("/api/checkins", { method: "POST", ... }).catch(() => {});
```

`src/context/AppContext.tsx` — Theme sync:
```tsx
fetch("/api/users/preferences", { ... }).catch(() => {
  // Ignore sync failures; local settings are still saved.
});
```

**Unaborted Fetch Requests:**
- `src/components/navigation/RightPanel.tsx`: AbortController used on some fetches but not all
- Component unmount may leave dangling fetch promises

### 5.4 Hardcoded Values That Should Be Configurable

| Value | File | Line Area | Current Value |
|-------|------|-----------|---------------|
| Connectivity check interval | `ConnectivityBanner.tsx` | ~30 | 30,000 ms |
| Connectivity timeout | `ConnectivityBanner.tsx` | ~25 | 7,000 ms |
| Max logs per import | `progressions/logs/import/route.ts` | ~20 | 10,000 |
| Password min length | `auth/register/route.ts` | ~38 | 4 characters |
| Bcrypt salt rounds | `auth/register/route.ts` | ~55 | 10 |
| Max comment length | `checkins/route.ts` | ~30 | 500 chars |
| Max note content | `checkins/notes/route.ts` | ~25 | 2,000 chars |
| Bottom bar nav height | `mobile.css` | ~3 | 74px |
| Resistance band options | `workout/page.tsx` | ~50 | [2.5, 5, 7.5, 10, 12.5, 15, 20, 25, 30] |
| Theme list | Multiple files | — | Array of 5 theme names |
| Day abbreviations | `constants.ts` | ~77-100 | 3 separate arrays for same concept |
| Difficulty color mapping | `constants.ts` + `globals.css` | — | Duplicated in JS and CSS |
| Capacitor server URL | `capacitor.config.ts` | ~3 | `http://192.168.1.105:3000/` |
| Items per page | `exercise-library/page.tsx` | ~5 | 20 |
| Analytics magic multipliers | `exercise-analytics.ts` | ~233 | `repsTotal * 1.4 + holdTotal * 0.8 + vol * 0.02 + level * 10` |

### 5.5 Empty/Unused Code

- `src/lib/constants/` directory exists but is **empty** — constants are in `src/lib/constants.ts` instead
- `DIFFICULTY_LEVELS`, `EXERCISE_TYPES`, `TARGET_GROUPS` arrays in `constants.ts` are **empty** with TODO comments
- `getAutoGymLevelFromSet()` in `UnifiedTrainingLogTable.tsx` is a **stub** that always returns `undefined`

---

## 6. Security Issues

### 6.1 CRITICAL: No Server-Side Authentication

**The entire application has no server-side session management.**

`src/context/AuthContext.tsx`:
```tsx
// Auth state is stored ONLY in localStorage
const login = useCallback((userData: User, rememberMe = false) => {
  setUser(userData);
  persistUser(JSON.stringify(userData), rememberMe);
}, []);
```

`src/app/api/auth/login/route.ts`:
```tsx
// Login returns user data directly — no token issued
return NextResponse.json({
  user: { id: user.id, username: user.username, name: user.name, role: user.role },
});
```

**Impact:**
- Any API route can be called by anyone — no authentication verification
- User identity is self-reported via `userId` parameter
- Admin role check uses client-provided ` x-user-role` header (spoofable)
- A user can impersonate any other user by modifying their localStorage or API parameters

### 6.2 CRITICAL: No Authorization on API Routes

**Every API route is publicly accessible. None verify the caller's identity:**

| Route | Data Exposed | Auth Check |
|-------|-------------|:----------:|
| `GET /api/users` | All users, activity counts | ❌ |
| `GET /api/checkins` | All check-in data | ❌ |
| `PATCH /api/users/[id]` | Can modify any user | ❌ |
| `DELETE /api/users/[id]` | Can delete any user | ❌ |
| `GET /api/users/preferences` | Any user's preferences | ❌ |
| `PUT /api/users/preferences` | Overwrite any user's preferences | ❌ |
| `GET /api/progressions?userId=X` | Any user's workout data | ❌ |
| `GET /api/exercises/history?userId=X` | Any user's exercise history | ❌ |
| `GET /api/progressions/logs/export?userId=X` | Export any user's logs | ❌ |
| `POST /api/exercises` | Admin check via header | ⚠️ Spoofable |
| `POST /api/admin/exercise-library/import` | Admin check via userId param | ⚠️ Self-reported |

### 6.3 HIGH: Credentials Stored in localStorage

`src/app/page.tsx` Lines ~35-43:
```tsx
// "Remember Me" stores PLAINTEXT PASSWORD in localStorage
const saved = localStorage.getItem(REMEMBERED_CREDENTIALS_KEY);
if (saved) {
  const { username: savedUser, password: savedPass } = JSON.parse(saved);
  if (savedUser) setUsername(savedUser);
  if (savedPass) setPassword(savedPass);  // Plain text password
}
```
- **Impact:** Any XSS vulnerability would expose the user's password
- **Fix:** Never store passwords client-side. Use secure HTTP-only session cookies.

### 6.4 MEDIUM: Weak Password Requirements

`src/app/api/auth/register/route.ts` Line ~38:
```tsx
if (password.length < 4 || password.length > 100) {
  return NextResponse.json({ error: "..." }, { status: 400 });
}
```
- Minimum password length of **4 characters** is dangerously weak
- No complexity requirements (no uppercase, numbers, symbols)
- **Fix:** Require minimum 8 characters with complexity rules.

### 6.5 MEDIUM: No Rate Limiting

- Login endpoint has no brute-force protection
- Import endpoints accept up to 10,000 items with no rate limiting
- No request throttling on any API route
- **Fix:** Add rate limiting middleware (e.g., `@upstash/ratelimit` or custom).

### 6.6 LOW: Inline Scripts (CSP Concern)

`src/app/layout.tsx` uses two `dangerouslySetInnerHTML` `<script>` blocks:
1. Theme initialization script
2. Platform detection + viewport override script

- These prevent setting a strict Content-Security-Policy
- **Fix:** Move to external script files or use nonce-based CSP.

---

## 7. File Size Summary

### Pages (by line count, descending)

| File | Lines | Assessment |
|------|------:|-----------|
| `src/app/dashboard/workout/page.tsx` | 3,443 | 🔴 Needs immediate decomposition |
| `src/app/dashboard/page.tsx` | 1,350 | 🔴 Too many responsibilities |
| `src/components/workout/UnifiedTrainingLogTable.tsx` | 1,319 | 🔴 Monolith component |
| `src/app/dashboard/exercise-library/page.tsx` | ~1,200 | 🟠 Should extract modals |
| `src/app/dashboard/settings/page.tsx` | ~1,200 | 🟠 Should extract sections |
| `src/app/dashboard/checkin/page.tsx` | ~1,000 | 🟠 Should extract register |
| `src/components/admin/DataManagement.tsx` | ~700 | 🟡 Acceptable but could split |
| `src/lib/exercise-analytics.ts` | ~640 | 🟡 Long function inside |
| `src/components/analytics/ExerciseCharts.tsx` | ~500 | 🟡 Chart types not separated |
| `src/components/ui/SetupWizard.tsx` | ~500 | 🟡 7-page wizard |
| `src/app/dashboard/admin/page.tsx` | ~500 | ✅ Acceptable |
| `src/components/layout/PageLayout.tsx` | ~400 | 🟡 Complex resize logic |
| `src/components/ui/PresetSlots.tsx` | ~400 | ✅ Multi-variant component |
| `src/components/workout/DisplaySettingsPopup.tsx` | ~400 | ✅ Acceptable |
| `src/lib/terminology.ts` | ~300 | ✅ Dictionary — acceptable |

### CSS

| File | Lines | Assessment |
|------|------:|-----------|
| `src/app/globals.css` | 1,500+ | 🔴 Should split into modules |
| `src/styles/mobile.css` | 10 | ⚠️ Nearly empty, consolidate |

### API Routes (28 total)

| Category | Routes | Total Complexity |
|----------|--------|-----------------|
| Auth | 3 | Low |
| Users | 3 | Medium |
| Exercises | 3 | Medium-High |
| Exercise Library | 2 | Medium |
| Progressions | 5 | High |
| Progression Logs | 4 | Very High (import) |
| Check-ins | 3 | Medium |
| Weight Standards | 2 | Medium |
| Admin | 4 | High |

---

## 8. Recommended Priority Actions

### Priority 1 — Security (Must Fix)

1. **Implement server-side authentication** — Add JWT or session cookie auth
2. **Add auth middleware** to all API routes
3. **Remove password from localStorage** — Never store credentials client-side
4. **Fix admin authorization** — Replace header-based admin check with token verification
5. **Increase minimum password length** to 8+ characters
6. **Add rate limiting** on auth endpoints

### Priority 2 — Performance (High Impact)

1. **Decompose `workout/page.tsx`** (3,443 lines) into 5-6 focused modules
2. **Batch database operations** in import routes (prevent 40,000 sequential queries)
3. **Add client-side data caching** (SWR or React Query)
4. **Memoize table rows** in UnifiedTrainingLogTable
5. **Lazy-load xlsx library** and decorative fonts
6. **Create health check endpoint** instead of pinging `/api/checkins`
7. **Replace manual aggregation** in `/api/users` with Prisma `groupBy`

### Priority 3 — Code Quality (Medium Impact)

1. **Extract shared API client utility** to eliminate fetch duplication
2. **Create `requireAdmin` middleware** for admin routes
3. **Extract modal components** from page files
4. **Consolidate theme constants** to a single source of truth
5. **Split globals.css** into modular CSS files
6. **Add error boundaries** at page level
7. **Implement consistent error response format** across all API routes

### Priority 4 — UI/UX (Polish)

1. **Add ARIA labels** to all interactive elements
2. **Add focus traps** to modal components
3. **Add loading skeletons** for all data-fetching states
4. **Add empty states** for lists and tables
5. **Centralize button styling** — enforce GlowButton usage
6. **Fix mobile browser experience** — remove forced 1280px viewport or provide responsive alternative
7. **Add keyboard navigation** to custom dropdowns and table interactions

---

## Appendix: Complete API Route Inventory

| # | Route | Methods | Auth | Issues |
|---|-------|---------|:----:|--------|
| 1 | `/api/auth/login` | POST | N/A | No session token issued |
| 2 | `/api/auth/register` | POST | N/A | 4-char min password |
| 3 | `/api/auth/logout` | POST | ❌ | Client-side only |
| 4 | `/api/users` | GET | ❌ | Exposes all users |
| 5 | `/api/users/[id]` | PATCH, DELETE | ❌ | Can modify any user |
| 6 | `/api/users/preferences` | GET, PUT | ❌ | Can read/write anyone's prefs |
| 7 | `/api/exercises` | GET, POST, DELETE | ⚠️ | Header-based admin check |
| 8 | `/api/exercises/[id]` | DELETE, PATCH | ⚠️ | Header-based admin check |
| 9 | `/api/exercises/history` | GET | ❌ | Any user's history |
| 10 | `/api/exercise-library` | GET, POST | ❌ | No auth on create |
| 11 | `/api/exercise-library/[id]` | PATCH, DELETE | ⚠️ | userId ownership (self-reported) |
| 12 | `/api/progressions` | GET, DELETE | ❌ | userId param (self-reported) |
| 13 | `/api/progressions/[id]` | GET, DELETE, PATCH | ⚠️ | userId ownership (self-reported) |
| 14 | `/api/progressions/[id]/level` | PUT | ❌ | No auth |
| 15 | `/api/progressions/[id]/log` | POST | ❌ | No auth |
| 16 | `/api/progressions/logs/export` | GET | ❌ | Can export anyone's data |
| 17 | `/api/progressions/logs/update` | POST | ⚠️ | Ownership check (self-reported) |
| 18 | `/api/progressions/logs/import` | POST | ❌ | N+1 query problem |
| 19 | `/api/progressions/logs/delete` | POST | ⚠️ | Ownership check (self-reported) |
| 20 | `/api/checkins` | GET, POST, DELETE | ⚠️ | Partial ownership check |
| 21 | `/api/checkins/notes` | GET, POST, PATCH, DELETE | ⚠️ | Ownership check (self-reported) |
| 22 | `/api/checkins/latest-weight` | GET | ❌ | Any user's weight |
| 23 | `/api/weight-standards` | GET | Public | Intentionally public |
| 24 | `/api/admin/weight-standards` | GET | ⚠️ | Admin via param |
| 25 | `/api/admin/weight-standards/[id]` | GET, PUT, DELETE | ⚠️ | Admin via param |
| 26 | `/api/admin/weight-standards/import` | POST | ⚠️ | Admin via param |
| 27 | `/api/admin/exercise-library/export` | GET | ⚠️ | Admin via param |
| 28 | `/api/admin/exercise-library/import` | POST | ⚠️ | Admin via param, N+1 |

---

*End of Codebase Analysis Report*
