-- ============================================================
-- EXERCISE DATA PURGE SCRIPT
-- ============================================================
-- This script removes ALL exercise data while preserving:
--   ✅ User accounts
--   ✅ Check-in records (CheckIn, CheckInNote)
--   ✅ User settings
--   ✅ Table structure (schema remains intact)
--
-- Tables purged (in dependency order):
--   1. ProgressionLog         (depends on UserProgressionLevel)
--   2. UserProgressionLevel   (depends on ProgressionExercise)
--   3. ProgressionModifier    (depends on ProgressionExercise)
--   4. ProgressionVariation   (depends on ProgressionExercise)
--   5. ProgressionTier        (depends on ProgressionExercise)
--   6. ProgressionExercise    (parent table)
--   7. Exercise               (legacy exercise table)
-- ============================================================

-- Delete in reverse dependency order to avoid FK constraint violations

-- Step 1: Delete all progression logs (child of UserProgressionLevel)
DELETE FROM ProgressionLog;

-- Step 2: Delete all user progression levels (child of ProgressionExercise)
DELETE FROM UserProgressionLevel;

-- Step 3: Delete all progression modifiers (child of ProgressionExercise)
DELETE FROM ProgressionModifier;

-- Step 4: Delete all progression variations (child of ProgressionExercise)
DELETE FROM ProgressionVariation;

-- Step 5: Delete all progression tiers (child of ProgressionExercise)
DELETE FROM ProgressionTier;

-- Step 6: Delete all progression exercises (parent table)
DELETE FROM ProgressionExercise;

-- Step 7: Delete all legacy exercises
DELETE FROM Exercise;

-- Reset SQLite autoincrement sequences (if any exist)
DELETE FROM sqlite_sequence WHERE name IN (
  'ProgressionLog',
  'UserProgressionLevel',
  'ProgressionModifier',
  'ProgressionVariation',
  'ProgressionTier',
  'ProgressionExercise',
  'Exercise'
);

-- Verify the purge
SELECT 'ProgressionLog' AS table_name, COUNT(*) AS remaining FROM ProgressionLog
UNION ALL
SELECT 'UserProgressionLevel', COUNT(*) FROM UserProgressionLevel
UNION ALL
SELECT 'ProgressionModifier', COUNT(*) FROM ProgressionModifier
UNION ALL
SELECT 'ProgressionVariation', COUNT(*) FROM ProgressionVariation
UNION ALL
SELECT 'ProgressionTier', COUNT(*) FROM ProgressionTier
UNION ALL
SELECT 'ProgressionExercise', COUNT(*) FROM ProgressionExercise
UNION ALL
SELECT 'Exercise', COUNT(*) FROM Exercise;
