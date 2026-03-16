-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Exercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wuxiaName" TEXT,
    "difficulty" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "story" TEXT,
    "targetGroup" TEXT,
    "assignedDays" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Exercise" ("assignedDays", "createdAt", "difficulty", "id", "name", "story", "targetGroup", "type", "wuxiaName")
SELECT "assignedDays", "createdAt", "difficulty", "id", COALESCE("originalName", "name"), "story", "targetGroup", "type", "name"
FROM "Exercise";
DROP TABLE "Exercise";
ALTER TABLE "new_Exercise" RENAME TO "Exercise";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
