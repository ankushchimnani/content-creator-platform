-- CreateEnum
CREATE TYPE "public"."ContentType" AS ENUM ('PRE_READ', 'ASSIGNMENT', 'LECTURE_NOTE');

-- AlterTable
ALTER TABLE "public"."Content" ADD COLUMN     "contentType" "public"."ContentType" NOT NULL DEFAULT 'LECTURE_NOTE',
ADD COLUMN     "difficulty" TEXT;

-- AlterTable
ALTER TABLE "public"."ContentAssignment" ADD COLUMN     "contentType" "public"."ContentType" NOT NULL DEFAULT 'LECTURE_NOTE',
ADD COLUMN     "difficulty" TEXT;
