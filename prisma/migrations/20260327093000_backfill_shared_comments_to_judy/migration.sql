-- Backfill legacy shared comments/notes to user "judy"

-- 1) Ensure Judy has a CheckIn row for each date that already has a comment.
INSERT INTO "CheckIn" ("id", "date", "userId", "weight", "comment", "present", "createdAt")
SELECT
  'migr_' || lower(hex(randomblob(16))),
  c."date",
  j."id",
  NULL,
  c."comment",
  0,
  CURRENT_TIMESTAMP
FROM "CheckIn" c
JOIN "User" j ON lower(j."username") = 'judy'
WHERE trim(coalesce(c."comment", '')) <> ''
  AND c."userId" <> j."id"
  AND NOT EXISTS (
    SELECT 1
    FROM "CheckIn" cj
    WHERE cj."date" = c."date"
      AND cj."userId" = j."id"
  );

-- 2) Copy one existing comment per date onto Judy's row when Judy's comment is empty.
UPDATE "CheckIn"
SET "comment" = (
  SELECT c2."comment"
  FROM "CheckIn" c2
  WHERE c2."date" = "CheckIn"."date"
    AND trim(coalesce(c2."comment", '')) <> ''
  ORDER BY c2."createdAt" ASC
  LIMIT 1
)
WHERE "userId" = (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1)
  AND trim(coalesce("comment", '')) = ''
  AND EXISTS (
    SELECT 1
    FROM "CheckIn" c3
    WHERE c3."date" = "CheckIn"."date"
      AND trim(coalesce(c3."comment", '')) <> ''
  );

-- 3) Clear legacy shared comments from non-Judy check-ins.
UPDATE "CheckIn"
SET "comment" = NULL
WHERE "userId" <> (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1)
  AND trim(coalesce("comment", '')) <> '';

-- 4) Move existing day notes to Judy when Judy has no note for that date.
UPDATE "CheckInNote"
SET "userId" = (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1)
WHERE "userId" <> (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1)
  AND trim(coalesce("content", '')) <> ''
  AND (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "CheckInNote" jn
    WHERE jn."date" = "CheckInNote"."date"
      AND jn."userId" = (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1)
  );

-- 5) Remove remaining non-Judy notes (these are legacy shared rows for dates already owned by Judy).
DELETE FROM "CheckInNote"
WHERE "userId" <> (SELECT "id" FROM "User" WHERE lower("username") = 'judy' LIMIT 1);
