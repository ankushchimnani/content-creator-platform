/*
  Warnings:

  - You are about to drop the column `brief` on the `Content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."Content" DROP COLUMN "brief";

-- CreateTable
CREATE TABLE "public"."GuidelinesTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "guidelines" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "GuidelinesTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuidelinesTemplate_name_key" ON "public"."GuidelinesTemplate"("name");

-- AddForeignKey
ALTER TABLE "public"."GuidelinesTemplate" ADD CONSTRAINT "GuidelinesTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
