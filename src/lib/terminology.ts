// ── Terminology Mode: Normal ↔ Fantasy ──
// Provides a translation layer for all UI text in the application.
// "fantasy" mode uses wuxia/xianxia cultivation vocabulary.
// "normal" mode uses conventional fitness/app terminology.

export type TerminologyMode = "fantasy" | "normal";

// The terminology dictionary maps fantasy terms to their normal equivalents.
// Keys are the fantasy terms (which are the defaults in the existing UI).
const terminologyMap: Record<string, string> = {
  // ── Navigation Labels ──
  "Dao Hall": "Dashboard",
  "Training Grounds": "Workout",
  "Technique Scroll": "Exercise Library",
  "Sect Register": "Check-In Log",
  "Cultivation Path": "Progress",
  "Ancient Records": "History",
  "Sect Hall": "Community",
  "Inner Chamber": "Settings",
  "Administrative Palace": "Admin Panel",
  "Ascension Codex": "Progressions",

  // ── Page Titles & Subtitles ──
  "Record attendance and physical metrics of all cultivators": "Record attendance and physical metrics of all members",
  "Configure your cultivation environment": "Configure your application settings",
  "Forge your body through martial cultivation": "Track your fitness journey",

  // ── Section Headers ──
  "Cultivation Journal": "Personal Journal",
  "Sect Member Notes": "Community Notes",
  "Registered Cultivators": "Registered Members",
  "Layout Configuration": "Layout Configuration",
  "Display Settings": "Display Settings",
  "Navigation Items": "Navigation Items",
  "Theme Styles": "Theme Styles",
  "Data Management": "Data Management",
  "Date Format": "Date Format",
  "Quick Actions": "Quick Actions",

  // ── Buttons & Actions ──
  "Start Training": "Start Workout",
  "Check In": "Check In",
  "Browse Techniques": "Browse Exercises",
  "View Path": "View Progress",
  "Quick Training": "Quick Workout",
  "Today's Check-In": "Today's Check-In",
  "Add Today's Date": "Add Today's Date",
  "Add Custom Date": "Add Custom Date",
  "Export Records": "Export Records",
  "Day Notes": "Day Notes",
  "Cultivation Notes": "Notes",
  "Save Note": "Save Note",
  "Import Scroll": "Import Data",
  "Export Sessions": "Export Sessions",
  "Remove All Sessions": "Remove All Sessions",
  "Import Techniques": "Import Exercises",
  "Export Techniques": "Export Exercises",
  "Remove All Techniques": "Remove All Exercises",
  "Import Check-In XLSX": "Import Check-In XLSX",
  "Export Check-In Records": "Export Check-In Records",

  // ── Stats & Realms ──
  "Mortal": "Beginner",
  "Foundation Establishment": "Novice",
  "Core Formation": "Intermediate",
  "Nascent Soul": "Advanced",
  "Soul Splitting": "Expert",
  "Tribulation Transcendence": "Elite",
  "Immortal": "Master",
  "Heavenly Dao": "Grandmaster",

  // ── Exercise Types ──
  "Upper Heaven": "Upper Body",
  "Lower Realms": "Lower Body",
  "Heart Meridian": "Cardio",
  "Unified Realm": "Full Body",

  // ── Target Groups ──
  "Iron Body Conditioning": "Strength Training",
  "Lightfoot Movement": "Agility Drills",
  "Meridian Flow": "Flexibility",
  "Inner Strength": "Core Strength",
  "Sword Forms": "Martial Arts",
  "Palm Techniques": "Hand Exercises",
  "Breathing Arts": "Breathing Exercises",
  "Mental Cultivation": "Mental Training",
  "Energy Circulation": "Warmup/Cooldown",
  "Combat Reflexes": "Reaction Training",

  // ── Difficulty Levels (display) ──
  "Mortal Realm": "Beginner Level",
  "Foundation Realm": "Novice Level",
  "Core Realm": "Intermediate Level",
  "Nascent Realm": "Advanced Level",

  // ── Misc UI Text ──
  "Cultivator": "Member",
  "Cultivators": "Members",
  "cultivator": "member",
  "cultivators": "members",
  "Technique": "Exercise",
  "Techniques": "Exercises",
  "technique": "exercise",
  "techniques": "exercises",
  "Sect": "Team",
  "sect": "team",
  "The path of cultivation is long": "Keep pushing forward",
  "No cultivators yet": "No members yet",
  "Record training observations, energy levels, insights...": "Record workout observations, energy levels, notes...",
  "Streak": "Streak",
  "Sessions": "Sessions",
  "Quick View": "Quick View",
  "Today's Cultivation": "Today's Activity",

  // ── Theme descriptions ──
  "Midnight Ink": "Midnight Ink",
  "Mountain Mist": "Mountain Mist",
  "Calligraphy": "Calligraphy",
  "Sakura": "Sakura",
  "Deep void & jade": "Deep void & jade",
  "Rice paper & ink": "Rice paper & ink",
  "Black & grey": "Black & grey",
  "Cherry blossom": "Cherry blossom",

  // ── Settings-specific ──
  "Confirm Purge": "Confirm Delete",
  "Confirm Technique Purge": "Confirm Exercise Delete",
  "Import Technique Scroll": "Import Exercise Data",
  "Training Sessions": "Workout Sessions",
  "Active Technique Cards": "Active Exercise Cards",
  "Recent Training Sessions": "Recent Workout Sessions",
  "Training Grounds Sidebar": "Workout Sidebar",
};

/**
 * Translate a UI string based on the current terminology mode.
 * In "fantasy" mode, returns the input unchanged (fantasy is the default).
 * In "normal" mode, looks up the normal equivalent.
 */
export function t(text: string, mode: TerminologyMode): string {
  if (mode === "fantasy") return text;
  return terminologyMap[text] ?? text;
}

/**
 * Get the appropriate nav label for a given nav item based on terminology mode.
 */
export function getNavLabel(fantasyLabel: string, mode: TerminologyMode): string {
  return t(fantasyLabel, mode);
}
