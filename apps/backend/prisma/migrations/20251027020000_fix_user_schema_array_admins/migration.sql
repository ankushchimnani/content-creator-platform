-- Add assignedAdminId array column (migrate data from CreatorAdminMapping)
ALTER TABLE "User" ADD COLUMN "assignedAdminId" TEXT[] DEFAULT '{}';

-- Migrate data from CreatorAdminMapping to assignedAdminId array
UPDATE "User" u
SET "assignedAdminId" = COALESCE(
  (SELECT ARRAY_AGG(cam."adminId")
   FROM "CreatorAdminMapping" cam
   WHERE cam."creatorId" = u.id),
  '{}'::TEXT[]
);

-- Drop CreatorAdminMapping table
DROP TABLE IF EXISTS "CreatorAdminMapping" CASCADE;

-- Rename course to courseAssigned
ALTER TABLE "User" RENAME COLUMN "course" TO "courseAssigned";

-- Drop coursePreferences column
ALTER TABLE "User" DROP COLUMN IF EXISTS "coursePreferences";