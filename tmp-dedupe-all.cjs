const { createClient } = require("@libsql/client");
require("dotenv/config");
const c = createClient({ url: process.env.DATABASE_URL });

async function deduplicate() {
  // 1. Find all duplicate exercise names
  const dupes = await c.execute(`
    SELECT name, GROUP_CONCAT(id) as ids
    FROM ProgressionExercise
    GROUP BY name HAVING COUNT(*) > 1
    ORDER BY name
  `);

  console.log("Found " + dupes.rows.length + " duplicate exercise groups\n");

  let totalLogsMoved = 0;
  let totalExercisesDeleted = 0;

  for (const dupe of dupes.rows) {
    const ids = String(dupe.ids).split(",");
    const name = dupe.name;

    // For each duplicate group, find which one has the most logs (that's the "keeper")
    let bestId = null;
    let bestLogs = -1;
    for (const id of ids) {
      const logCount = await c.execute({
        sql: `SELECT COUNT(*) as cnt FROM ProgressionLog pl
              JOIN UserProgressionLevel up ON pl.userProgressionId = up.id
              WHERE up.exerciseId = ?`,
        args: [id],
      });
      const cnt = Number(logCount.rows[0].cnt);
      if (cnt > bestLogs) {
        bestLogs = cnt;
        bestId = id;
      }
    }

    const removeIds = ids.filter(id => id !== bestId);
    let logsMoved = 0;

    for (const removeId of removeIds) {
      // Find all UPLs for the duplicate exercise
      const uplsToRemove = await c.execute({
        sql: "SELECT id, userId FROM UserProgressionLevel WHERE exerciseId = ?",
        args: [removeId],
      });

      for (const rmUPL of uplsToRemove.rows) {
        // Check if the keeper exercise already has a UPL for this user
        const keeperUPL = await c.execute({
          sql: "SELECT id FROM UserProgressionLevel WHERE exerciseId = ? AND userId = ?",
          args: [bestId, rmUPL.userId],
        });

        if (keeperUPL.rows.length > 0) {
          // Move logs from remove UPL to keeper UPL
          const moved = await c.execute({
            sql: "UPDATE ProgressionLog SET userProgressionId = ? WHERE userProgressionId = ?",
            args: [String(keeperUPL.rows[0].id), String(rmUPL.id)],
          });
          logsMoved += moved.rowsAffected;
        } else {
          // Just reassign this UPL to the keeper exercise
          await c.execute({
            sql: "UPDATE UserProgressionLevel SET exerciseId = ? WHERE id = ?",
            args: [bestId, String(rmUPL.id)],
          });
        }

        // Delete the now-empty UPL (only if we moved logs, not reassigned)
        if (keeperUPL.rows.length > 0) {
          await c.execute({ sql: "DELETE FROM UserProgressionLevel WHERE id = ?", args: [String(rmUPL.id)] });
        }
      }

      // Move tiers, variations, modifiers to keeper (avoid duplicates by checking name)
      for (const table of ["ProgressionTier", "ProgressionVariation", "ProgressionModifier"]) {
        // Just move them - duplicate names on the same exercise are unlikely to cause issues
        await c.execute({
          sql: `UPDATE ${table} SET exerciseId = ? WHERE exerciseId = ?`,
          args: [bestId, removeId],
        });
      }

      // Delete the duplicate exercise
      await c.execute({ sql: "DELETE FROM ProgressionExercise WHERE id = ?", args: [removeId] });
      totalExercisesDeleted++;
    }

    totalLogsMoved += logsMoved;
    if (logsMoved > 0) {
      console.log(name + ": moved " + logsMoved + " logs, removed " + removeIds.length + " duplicate(s)");
    } else {
      console.log(name + ": removed " + removeIds.length + " duplicate(s)");
    }
  }

  // Now deduplicate tiers/variations/modifiers that may have been doubled
  console.log("\n--- Deduplicating child records ---");
  for (const table of ["ProgressionTier", "ProgressionVariation", "ProgressionModifier"]) {
    const dupChildren = await c.execute(`
      SELECT exerciseId, name, COUNT(*) as cnt, GROUP_CONCAT(id) as ids
      FROM ${table}
      GROUP BY exerciseId, name HAVING cnt > 1
    `);
    let deleted = 0;
    for (const dc of dupChildren.rows) {
      const childIds = String(dc.ids).split(",");
      // Keep first, delete rest
      for (let i = 1; i < childIds.length; i++) {
        await c.execute({ sql: `DELETE FROM ${table} WHERE id = ?`, args: [childIds[i]] });
        deleted++;
      }
    }
    if (deleted > 0) console.log(table + ": removed " + deleted + " duplicates");
  }

  // Verify no more duplicates
  const remaining = await c.execute("SELECT name, COUNT(*) as cnt FROM ProgressionExercise GROUP BY name HAVING cnt > 1");
  console.log("\n=== Remaining duplicate exercises: " + remaining.rows.length + (remaining.rows.length === 0 ? " ✓ CLEAN" : " ✗ STILL DIRTY") + " ===");

  console.log("\nSummary: moved " + totalLogsMoved + " logs, deleted " + totalExercisesDeleted + " duplicate exercises");
  c.close();
}

deduplicate();
