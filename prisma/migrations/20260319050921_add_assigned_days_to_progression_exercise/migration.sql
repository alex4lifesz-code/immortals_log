-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProgressionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "wuxiaName" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT '',
    "story" TEXT NOT NULL DEFAULT '',
    "tips" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "equipmentType" TEXT NOT NULL,
    "bodyweight" BOOLEAN NOT NULL DEFAULT true,
    "weighted" BOOLEAN NOT NULL DEFAULT false,
    "rings" BOOLEAN NOT NULL DEFAULT false,
    "primaryMuscles" TEXT NOT NULL,
    "secondaryMuscles" TEXT NOT NULL DEFAULT '',
    "assignedDays" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL
);
INSERT INTO "new_ProgressionExercise" ("bodyweight", "category", "createdAt", "difficulty", "equipmentType", "id", "name", "primaryMuscles", "rings", "secondaryMuscles", "story", "tips", "type", "userId", "weighted", "wuxiaName") SELECT "bodyweight", "category", "createdAt", "difficulty", "equipmentType", "id", "name", "primaryMuscles", "rings", "secondaryMuscles", "story", "tips", "type", "userId", "weighted", "wuxiaName" FROM "ProgressionExercise";
DROP TABLE "ProgressionExercise";
ALTER TABLE "new_ProgressionExercise" RENAME TO "ProgressionExercise";
CREATE INDEX "ProgressionExercise_userId_idx" ON "ProgressionExercise"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
