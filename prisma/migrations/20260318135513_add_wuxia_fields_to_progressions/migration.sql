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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL
);
INSERT INTO "new_ProgressionExercise" ("bodyweight", "category", "createdAt", "equipmentType", "id", "name", "primaryMuscles", "rings", "secondaryMuscles", "userId", "weighted") SELECT "bodyweight", "category", "createdAt", "equipmentType", "id", "name", "primaryMuscles", "rings", "secondaryMuscles", "userId", "weighted" FROM "ProgressionExercise";
DROP TABLE "ProgressionExercise";
ALTER TABLE "new_ProgressionExercise" RENAME TO "ProgressionExercise";
CREATE INDEX "ProgressionExercise_userId_idx" ON "ProgressionExercise"("userId");
CREATE TABLE "new_ProgressionTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "wuxiaName" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "targetHold" INTEGER,
    "targetReps" INTEGER,
    CONSTRAINT "ProgressionTier_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProgressionTier" ("description", "exerciseId", "id", "level", "name", "targetHold", "targetReps") SELECT "description", "exerciseId", "id", "level", "name", "targetHold", "targetReps" FROM "ProgressionTier";
DROP TABLE "ProgressionTier";
ALTER TABLE "new_ProgressionTier" RENAME TO "ProgressionTier";
CREATE INDEX "ProgressionTier_exerciseId_idx" ON "ProgressionTier"("exerciseId");
CREATE TABLE "new_ProgressionVariation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "wuxiaName" TEXT NOT NULL DEFAULT '',
    "difficulty" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ProgressionVariation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProgressionVariation" ("description", "exerciseId", "id", "name") SELECT "description", "exerciseId", "id", "name" FROM "ProgressionVariation";
DROP TABLE "ProgressionVariation";
ALTER TABLE "new_ProgressionVariation" RENAME TO "ProgressionVariation";
CREATE INDEX "ProgressionVariation_exerciseId_idx" ON "ProgressionVariation"("exerciseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
