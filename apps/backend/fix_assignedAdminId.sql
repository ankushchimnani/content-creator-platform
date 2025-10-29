-- Fix corrupted assignedAdminId column
-- Drop the corrupted column
ALTER TABLE "User" DROP COLUMN IF EXISTS "assignedAdminId";

-- Add it back as a proper TEXT array with default empty array
ALTER TABLE "User" ADD COLUMN "assignedAdminId" TEXT[] DEFAULT '{}';