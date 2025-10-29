-- Migration to convert courseAssigned from String to String[]
-- This preserves existing data by converting single values to arrays

-- Step 1: Add a temporary array column
ALTER TABLE "User" ADD COLUMN "courseAssigned_new" TEXT[] DEFAULT '{}';

-- Step 2: Migrate existing data - convert non-null strings to single-element arrays
UPDATE "User"
SET "courseAssigned_new" = ARRAY["courseAssigned"]::TEXT[]
WHERE "courseAssigned" IS NOT NULL AND "courseAssigned" != '';

-- Step 3: Drop the old column
ALTER TABLE "User" DROP COLUMN "courseAssigned";

-- Step 4: Rename the new column to the original name
ALTER TABLE "User" RENAME COLUMN "courseAssigned_new" TO "courseAssigned";

-- Step 5: Set default value for new rows
ALTER TABLE "User" ALTER COLUMN "courseAssigned" SET DEFAULT '{}';
