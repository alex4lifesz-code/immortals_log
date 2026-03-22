import { readFileSync } from "fs";

// Simulate the processFile logic + progression upload

const json = JSON.parse(readFileSync("C:/Users/Admin/Desktop/codex300.json", "utf8"));
const exercisesArr = Array.isArray(json) ? json : json.exercises;

// Build library payload (same as processFile)
const libraryPayload = exercisesArr.map((ex) => {
  const tiers = ex.progressions || ex.tiers;
  const lastTier = tiers?.length ? tiers[tiers.length - 1] : undefined;
  const maxDifficulty =
    lastTier?.wuxiaDifficulty ||
    lastTier?.difficulty ||
    ex.wuxiaDifficulty ||
    ex.difficulty ||
    "Mortal";
  return {
    name: ex.name,
    wuxiaName: ex.wuxiaName || "",
    difficulty: maxDifficulty,
    type: ex.wuxiaType || ex.type || "Unified Realm",
    story: ex.story || "",
    targetGroup: ex.category || "",
  };
});

console.log("Library payload:", JSON.stringify(libraryPayload, null, 2));
console.log("\n--- Progression exercises ---");
for (const ex of exercisesArr) {
  console.log(`Exercise: ${ex.name}`);
  console.log(`  category: ${ex.category}`);
  console.log(`  primaryMuscles: ${JSON.stringify(ex.primaryMuscles)}`);
  console.log(`  tiers: ${(ex.progressions || ex.tiers || []).length}`);
  console.log(`  variations: ${(ex.variations || []).length}`);
  console.log(`  modifiers: ${(ex.modifiers || []).length}`);
  const tiers = ex.progressions || ex.tiers || [];
  for (const t of tiers) {
    if (!t.level || !t.name) {
      console.log(`  !! INVALID TIER: ${JSON.stringify(t)}`);
    }
  }
}
