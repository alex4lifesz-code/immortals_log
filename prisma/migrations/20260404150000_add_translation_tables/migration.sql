CREATE TABLE "ExerciseTranslation" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExerciseTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProgressionExerciseTranslation" (
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
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressionExerciseTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProgressionTierTranslation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "englishName" TEXT NOT NULL,
  "vietnameseName" TEXT NOT NULL,
  "englishDescription" TEXT,
  "vietnameseDescription" TEXT,
  "englishDifficulty" TEXT,
  "vietnameseDifficulty" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressionTierTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionTier" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProgressionVariationTranslation" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "englishName" TEXT NOT NULL,
  "vietnameseName" TEXT NOT NULL,
  "englishDescription" TEXT,
  "vietnameseDescription" TEXT,
  "englishDifficulty" TEXT,
  "vietnameseDifficulty" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProgressionVariationTranslation_id_fkey" FOREIGN KEY ("id") REFERENCES "ProgressionVariation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "ExerciseTranslation" (
  "id",
  "englishName",
  "vietnameseName",
  "englishStory",
  "vietnameseStory",
  "englishDifficulty",
  "vietnameseDifficulty",
  "englishType",
  "vietnameseType"
)
SELECT
  "id",
  "name",
  COALESCE(NULLIF("wuxiaName", ''), "name"),
  "story",
  "story",
  "difficulty",
  "difficulty",
  "type",
  "type"
FROM "Exercise";

INSERT INTO "ProgressionExerciseTranslation" (
  "id",
  "englishName",
  "vietnameseName",
  "englishStory",
  "vietnameseStory",
  "englishDifficulty",
  "vietnameseDifficulty",
  "englishType",
  "vietnameseType"
)
SELECT
  "id",
  "name",
  COALESCE(NULLIF("wuxiaName", ''), "name"),
  "story",
  "story",
  "difficulty",
  COALESCE(NULLIF("wuxiaDifficulty", ''), "difficulty"),
  "type",
  COALESCE(NULLIF("wuxiaType", ''), "type")
FROM "ProgressionExercise";

INSERT INTO "ProgressionTierTranslation" (
  "id",
  "englishName",
  "vietnameseName",
  "englishDescription",
  "vietnameseDescription",
  "englishDifficulty",
  "vietnameseDifficulty"
)
SELECT
  "id",
  "name",
  COALESCE(NULLIF("wuxiaName", ''), "name"),
  "description",
  "description",
  "difficulty",
  COALESCE(NULLIF("wuxiaDifficulty", ''), "difficulty")
FROM "ProgressionTier";

INSERT INTO "ProgressionVariationTranslation" (
  "id",
  "englishName",
  "vietnameseName",
  "englishDescription",
  "vietnameseDescription",
  "englishDifficulty",
  "vietnameseDifficulty"
)
SELECT
  "id",
  "name",
  COALESCE(NULLIF("wuxiaName", ''), "name"),
  "description",
  "description",
  "difficulty",
  COALESCE(NULLIF("wuxiaDifficulty", ''), "difficulty")
FROM "ProgressionVariation";