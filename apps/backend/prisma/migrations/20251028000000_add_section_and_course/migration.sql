-- CreateEnum: Add Section enum for content categorization
-- This migration is 100% backward compatible - all new fields are optional (nullable)

-- Step 1: Create the Section enum type
CREATE TYPE "Section" AS ENUM ('PRE_ORDER', 'IN_ORDER', 'POST_ORDER');

-- Step 2: Add optional 'section' column to ContentAssignment table
-- Using NULL default ensures existing assignments are not affected
ALTER TABLE "ContentAssignment"
  ADD COLUMN "section" "Section";

-- Step 3: Add optional 'course' column to ContentAssignment table
-- Using NULL default ensures existing assignments are not affected
ALTER TABLE "ContentAssignment"
  ADD COLUMN "course" TEXT;

-- Step 4: Add optional 'section' column to Content table
-- This will be populated from the assignment when content is created
ALTER TABLE "Content"
  ADD COLUMN "section" "Section";

-- Step 5: Add optional 'course' column to Content table
-- This will be populated from the assignment when content is created
ALTER TABLE "Content"
  ADD COLUMN "course" TEXT;

-- No data migration needed - all existing records will have NULL values
-- This is intentional and safe:
-- - Frontend will display "Not Specified" or "-" for NULL values
-- - Filters will include NULL values in "All" category
-- - Admins can later edit assignments to add section/course

-- Verification queries (commented out, for reference):
-- SELECT COUNT(*) FROM "ContentAssignment" WHERE "section" IS NULL; -- Should show all existing
-- SELECT COUNT(*) FROM "Content" WHERE "section" IS NULL; -- Should show all existing
