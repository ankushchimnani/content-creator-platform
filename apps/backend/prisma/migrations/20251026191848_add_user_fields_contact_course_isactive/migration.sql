/*
  Warnings:

  - You are about to drop the column `preferences` on the `User` table. All the data in the column will be lost.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/

-- First, update any NULL names to a default value
UPDATE "public"."User" SET "name" = 'User' WHERE "name" IS NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "preferences",
ADD COLUMN     "contactNumber" TEXT,
ADD COLUMN     "course" TEXT,
ADD COLUMN     "coursePreferences" JSONB,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ALTER COLUMN "name" SET NOT NULL;
