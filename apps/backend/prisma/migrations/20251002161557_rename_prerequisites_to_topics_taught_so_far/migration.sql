/*
  Warnings:

  - You are about to drop the column `prerequisiteTopics` on the `ContentAssignment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."ContentAssignment" DROP COLUMN "prerequisiteTopics",
ADD COLUMN     "topicsTaughtSoFar" TEXT[];
