-- CreateTable
CREATE TABLE "ProgressionExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "ProgressionTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "targetHold" INTEGER,
    "targetReps" INTEGER,
    CONSTRAINT "ProgressionTier_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressionVariation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ProgressionVariation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressionModifier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "difficultyMod" REAL NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "ProgressionModifier_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserProgressionLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProgressionLevel_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProgressionLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userProgressionId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "holdTime" INTEGER,
    "reps" INTEGER,
    "notes" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgressionLog_userProgressionId_fkey" FOREIGN KEY ("userProgressionId") REFERENCES "UserProgressionLevel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProgressionExercise_userId_idx" ON "ProgressionExercise"("userId");

-- CreateIndex
CREATE INDEX "ProgressionTier_exerciseId_idx" ON "ProgressionTier"("exerciseId");

-- CreateIndex
CREATE INDEX "ProgressionVariation_exerciseId_idx" ON "ProgressionVariation"("exerciseId");

-- CreateIndex
CREATE INDEX "ProgressionModifier_exerciseId_idx" ON "ProgressionModifier"("exerciseId");

-- CreateIndex
CREATE INDEX "UserProgressionLevel_userId_idx" ON "UserProgressionLevel"("userId");

-- CreateIndex
CREATE INDEX "UserProgressionLevel_exerciseId_idx" ON "UserProgressionLevel"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserProgressionLevel_userId_exerciseId_key" ON "UserProgressionLevel"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "ProgressionLog_userProgressionId_idx" ON "ProgressionLog"("userProgressionId");
