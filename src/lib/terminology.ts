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

  // ── Exercises Page ──
  "Grand Technique Archive": "Exercise Library",
  "Library Index": "Categories",
  "Browse, inscribe, and study the collected martial wisdom": "Browse, add, and study your exercise collection",
  "Within these hallowed shelves lie the collected wisdom of countless martial scholars.\nBrowse by cultivation realm, dao path, or ancient discipline.": "Your complete exercise library.\nBrowse by difficulty, type, or target muscle group.",
  "scrolls catalogued": "exercises catalogued",
  "with progression tiers": "with progression tiers",
  "scrolls": "exercises",
  "scroll": "exercise",
  "Inscribe New Technique": "Add New Exercise",
  "Cultivation Realm": "Difficulty Level",
  "All Realms": "All Levels",
  "Dao Path": "Exercise Type",
  "All Paths": "All Types",
  "Martial Focus": "Target Muscle",
  "All Disciplines": "All Muscles",
  "Training Day": "Training Day",
  "Ordering": "Sort By",
  "Realm Catalogue": "Difficulty Breakdown",
  "Archive Management": "Library Management",
  "Technique Archive": "Exercise Library",
  "Cultivation Realms": "Difficulty Levels",
  "Dao Paths": "Exercise Types",
  "Martial Disciplines": "Target Muscles",
  "The Grand Archive Stands Empty": "No Exercises Yet",
  "No Scrolls Match Your Query": "No Exercises Found",
  "Inscribe techniques manually or import a JSON manuscript to populate the library shelves.": "Add exercises manually or import a JSON file to populate your library.",
  "Try broadening your search or adjusting the realm and path filters.": "Try broadening your search or adjusting your filters.",
  "The archive is read-only. Ask the Grand Archivist (administrator) to inscribe techniques.": "The library is read-only. Ask an administrator to add exercises.",
  "Inscribe First Technique": "Add First Exercise",
  "Catalog New Technique": "Add New Exercise",
  "Ancient Lore": "Description",
  "No lore has been inscribed for this technique.": "No description has been added for this exercise.",
  "No ancient lore inscribed for this technique.": "No description added for this exercise.",
  "Cultivation Pathway": "Progression Pathway",
  "Cultivation Progress": "Progression Progress",
  "tier": "tier",
  "tiers mastered": "tiers mastered",
  "Training Specifications": "Training Specifications",
  "Remove Technique": "Remove Exercise",
  "Confirm Remove": "Confirm Remove",
  "Are you sure you want to remove this technique? This action cannot be undone.": "Are you sure you want to remove this exercise? This action cannot be undone.",
  "Upload Technique Scroll": "Import Exercise Data",
  "Purge All Exercises": "Delete All Exercises",
  "Search by name, lore, realm, or focus...": "Search by name, description, or muscle...",
  "Search techniques...": "Search exercises...",
  "Realm (Low → High)": "Difficulty (Low → High)",
  "Realm (High → Low)": "Difficulty (High → Low)",
  "By Dao Path": "By Type",
  "Favourites First": "Favourites First",
  "Library Desk": "Exercise Details",
  "Entry Identity": "Exercise Name",
  "Wuxia Name (Optional)": "Alternate Name (Optional)",
  "Classification": "Category",
  "Tier Manuscript": "Progression Tiers",
  "Technique Lore": "Exercise Description",
  "Catalog Technique With Tiers": "Add Exercise With Tiers",
  "Name A–Z": "Name A–Z",
  "Name Z–A": "Name Z–A",
  "Recently Added": "Recently Added",

  // ── Exercises Page – detail modal / misc ──
  "Realm": "Difficulty",
  "Path": "Type",
  "Focus": "Target",
  "Wuxia title": "Fantasy name",
  "Conventional name": "Standard name",
  "tiers": "levels",
  "mastered": "completed",
  "Progression Tiers": "Progression Levels",
  "Training Notes": "Training Notes",
  "Technique Scroll Detail": "Exercise Detail",
  "Add one new archive entry with both readable metadata and progression tiers for the training ladder.": "Add a new exercise with metadata and progression levels for tracking.",

  // ── Tier Detail Modal ──
  "Mastered": "Completed",
  "Current Tier": "Current Level",
  "Locked": "Locked",
  "Tier": "Level",
  "Parent Exercise": "Parent Exercise",
  "Description": "Description",
  "Equipment": "Equipment",
  "Primary": "Primary",
  "Secondary": "Secondary",
  "Progression Overview": "Progression Overview",
  "Calisthenics": "Calisthenics",
  "calisthenics tiers": "calisthenics progressions",
  "catalogued": "catalogued",
  "matching": "matching",
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
