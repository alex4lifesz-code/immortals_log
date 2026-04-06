/*
  Warnings:

  - Made the column `friendCode` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "fitnessBackground" TEXT,
    "primaryGoal" TEXT,
    "trainingDaysPerWeek" INTEGER,
    "assessmentAnswers" TEXT,
    "recommendedTier" TEXT,
    "currentTier" TEXT,
    "publicProfile" BOOLEAN NOT NULL DEFAULT false,
    "displayName" TEXT,
    "gettingStartedDismissed" BOOLEAN NOT NULL DEFAULT false,
    "gettingStartedTasks" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FriendSuggestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "suggestedId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ExerciseTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "englishName" TEXT NOT NULL,
    "vietnameseName" TEXT NOT NULL,
    "englishStory" TEXT,
    "vietnameseStory" TEXT,
    "englishDifficulty" TEXT,
    "vietnameseDifficulty" TEXT,
    "englishType" TEXT,
    "vietnameseType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExerciseTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ExerciseTranslation" ("createdAt", "englishDifficulty", "englishName", "englishStory", "englishType", "id", "updatedAt", "vietnameseDifficulty", "vietnameseName", "vietnameseStory", "vietnameseType") SELECT "createdAt", "englishDifficulty", "englishName", "englishStory", "englishType", "id", "updatedAt", "vietnameseDifficulty", "vietnameseName", "vietnameseStory", "vietnameseType" FROM "ExerciseTranslation";
DROP TABLE "ExerciseTranslation";
ALTER TABLE "new_ExerciseTranslation" RENAME TO "ExerciseTranslation";
CREATE TABLE "new_ProgressionExerciseTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "englishName" TEXT NOT NULL,
    "vietnameseName" TEXT NOT NULL,
    "englishStory" TEXT,
    "vietnameseStory" TEXT,
    "englishDifficulty" TEXT,
    "vietnameseDifficulty" TEXT,
    "englishType" TEXT,
    "vietnameseType" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressionExerciseTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProgressionExerciseTranslation" ("createdAt", "englishDifficulty", "englishName", "englishStory", "englishType", "id", "updatedAt", "vietnameseDifficulty", "vietnameseName", "vietnameseStory", "vietnameseType") SELECT "createdAt", "englishDifficulty", "englishName", "englishStory", "englishType", "id", "updatedAt", "vietnameseDifficulty", "vietnameseName", "vietnameseStory", "vietnameseType" FROM "ProgressionExerciseTranslation";
DROP TABLE "ProgressionExerciseTranslation";
ALTER TABLE "new_ProgressionExerciseTranslation" RENAME TO "ProgressionExerciseTranslation";
CREATE TABLE "new_ProgressionTierTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "englishName" TEXT NOT NULL,
    "vietnameseName" TEXT NOT NULL,
    "englishDescription" TEXT,
    "vietnameseDescription" TEXT,
    "englishDifficulty" TEXT,
    "vietnameseDifficulty" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressionTierTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionTier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProgressionTierTranslation" ("createdAt", "englishDescription", "englishDifficulty", "englishName", "id", "updatedAt", "vietnameseDescription", "vietnameseDifficulty", "vietnameseName") SELECT "createdAt", "englishDescription", "englishDifficulty", "englishName", "id", "updatedAt", "vietnameseDescription", "vietnameseDifficulty", "vietnameseName" FROM "ProgressionTierTranslation";
DROP TABLE "ProgressionTierTranslation";
ALTER TABLE "new_ProgressionTierTranslation" RENAME TO "ProgressionTierTranslation";
CREATE TABLE "new_ProgressionVariationTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "englishName" TEXT NOT NULL,
    "vietnameseName" TEXT NOT NULL,
    "englishDescription" TEXT,
    "vietnameseDescription" TEXT,
    "englishDifficulty" TEXT,
    "vietnameseDifficulty" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProgressionVariationTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionVariation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProgressionVariationTranslation" ("createdAt", "englishDescription", "englishDifficulty", "englishName", "id", "updatedAt", "vietnameseDescription", "vietnameseDifficulty", "vietnameseName") SELECT "createdAt", "englishDescription", "englishDifficulty", "englishName", "id", "updatedAt", "vietnameseDescription", "vietnameseDifficulty", "vietnameseName" FROM "ProgressionVariationTranslation";
DROP TABLE "ProgressionVariationTranslation";
ALTER TABLE "new_ProgressionVariationTranslation" RENAME TO "ProgressionVariationTranslation";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "friendCode" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingSkipped" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "friendCode", "id", "name", "password", "role", "updatedAt", "username") SELECT "createdAt", "friendCode", "id", "name", "password", "role", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- CreateIndex
CREATE INDEX "FriendSuggestion_userId_idx" ON "FriendSuggestion"("userId");

-- CreateIndex
CREATE INDEX "FriendSuggestion_suggestedId_idx" ON "FriendSuggestion"("suggestedId");
