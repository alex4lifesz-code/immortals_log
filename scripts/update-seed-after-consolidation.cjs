/**
 * One-off: rewrites seed-data/exercise-library-full.json to match the
 * consolidated DB shape (parents-with-variants instead of standalone children).
 *
 * Mirrors the MERGES config from scripts/consolidate-exercise-variants.ts.
 */
const fs = require("node:fs");
const path = require("node:path");

const SEED_PATH = path.resolve(__dirname, "..", "seed-data", "exercise-library-full.json");

const MERGES = [
  {
    parent: "Pull up",
    ensureVariants: ["Wide", "Close", "Neutral", "Chin up", "Behind the neck"],
    children: ["Gym Pull up"],
  },
  {
    parent: "Calf raise",
    ensureVariants: ["Standing", "Seated", "Donkey", "Single leg"],
    children: ["Gym Calf raise"],
  },
  {
    parent: "Step up",
    ensureVariants: ["Bodyweight", "Dumbbell", "Barbell", "Lateral"],
    children: ["Gym Step up"],
  },
  {
    parent: "Leg raise",
    ensureVariants: ["Hanging", "Lying", "Captain's chair", "Toes to bar"],
    children: ["Gym Leg raise"],
  },
  {
    parent: "Hip thrust",
    ensureVariants: ["Bodyweight", "Barbell", "Single leg", "Banded"],
    children: ["Gym Hip thrust"],
  },
  {
    parent: "Deadlift",
    ensureVariants: [
      "Conventional", "Sumo", "Romanian", "Stiff leg", "Snatch grip", "Trap bar",
      "Axle bar", "Deficit", "Block", "Rack pull", "Single leg", "Reeves",
      "Jefferson", "Sumo high pull",
    ],
    children: [
      "Sumo deadlift", "Romanian deadlift", "Stiff leg deadlift", "Snatch grip deadlift",
      "Trap bar deadlift", "Axle bar deadlift", "Deficit deadlift", "Block pull",
      "Rack pull", "Single leg deadlift", "Reeves deadlift", "Jefferson deadlift",
      "Sumo deadlift high pull",
    ],
  },
  {
    parent: "Lunge",
    ensureVariants: ["Forward", "Reverse", "Walking", "Lateral", "Curtsy", "Barbell", "Dumbbell"],
    children: ["Walking lunge", "Reverse lunge", "Lateral lunge", "Curtsy lunge", "Barbell lunge"],
  },
  {
    parent: "Shoulder press",
    ensureVariants: ["Strict", "Push press", "Push jerk", "Split jerk", "Log", "Landmine"],
    children: ["Push press", "Push jerk", "Split jerk", "Log press", "Landmine press"],
  },
  {
    parent: "Clean",
    ensureVariants: ["Power", "Hang", "Squat", "Muscle", "Kettlebell", "Clean and jerk"],
    children: ["Power clean", "Hang clean", "Kettlebell clean", "Clean and jerk"],
  },
  {
    parent: "Snatch",
    ensureVariants: ["Power", "Muscle", "Squat", "Kettlebell"],
    children: ["Power snatch", "Muscle snatch", "Kettlebell snatch"],
  },
  {
    parent: "Tricep extension",
    ensureVariants: ["Overhead", "Skullcrusher", "Pushdown", "Kickback"],
    children: ["Tricep pushdown", "Tricep kickback"],
  },
  {
    parent: "Row",
    ensureVariants: ["Bent over", "Seated", "T-bar", "Single arm", "Pendlay", "Meadows", "Landmine", "Cable"],
    children: ["Landmine row"],
  },
  // Squat updates already applied to seed manually; mirror them so re-runs are idempotent.
  {
    parent: "Gym Squat",
    ensureVariants: [
      "Back", "Front", "Goblet", "Hack", "Zercher", "Pendulum", "Safety bar",
      "Belt", "Overhead", "Landmine", "Anderson", "Box", "Pause", "Pin", "Tempo",
    ],
    children: [],
  },
];

function eqLower(a, b) {
  return String(a).toLowerCase() === String(b).toLowerCase();
}

function normalizeVariantList(existing, desired) {
  const seen = new Set();
  const out = [];
  for (const name of [...existing, ...desired]) {
    const key = String(name).trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(name).trim());
  }
  return out;
}

function main() {
  const raw = fs.readFileSync(SEED_PATH, "utf8");
  const json = JSON.parse(raw);

  if (!Array.isArray(json.exercises) && !Array.isArray(json)) {
    throw new Error("Unexpected seed shape: missing exercises array");
  }
  // Seed file is a top-level array of exercises in this repo's existing format.
  const exercises = Array.isArray(json) ? json : json.exercises;

  const childNamesAll = new Set();
  for (const block of MERGES) for (const c of block.children) childNamesAll.add(c.toLowerCase());

  const before = exercises.length;
  // Remove children
  const filtered = exercises.filter((e) => !childNamesAll.has(String(e.name).toLowerCase()));
  const removed = before - filtered.length;

  // Patch parents' variations
  let parentsPatched = 0;
  let variantsAdded = 0;
  for (const block of MERGES) {
    const parent = filtered.find((e) => eqLower(e.name, block.parent));
    if (!parent) {
      console.warn(`[skip] parent "${block.parent}" not found in seed`);
      continue;
    }
    const existing = Array.isArray(parent.variations) ? parent.variations.slice() : [];
    const next = normalizeVariantList(existing, block.ensureVariants);
    if (next.length !== existing.length) {
      variantsAdded += next.length - existing.length;
      parentsPatched += 1;
      parent.variations = next;
    }
  }

  if (Array.isArray(json)) {
    fs.writeFileSync(SEED_PATH, JSON.stringify(filtered, null, 2) + "\n", "utf8");
  } else {
    json.exercises = filtered;
    fs.writeFileSync(SEED_PATH, JSON.stringify(json, null, 2) + "\n", "utf8");
  }

  console.log(`Seed updated:`);
  console.log(`  exercises: ${before} -> ${filtered.length} (removed ${removed})`);
  console.log(`  parents patched: ${parentsPatched}`);
  console.log(`  variants added: ${variantsAdded}`);
}

main();
