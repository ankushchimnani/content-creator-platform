-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SUPERADMIN';

-- CreateTable
CREATE TABLE "public"."PaymentConfiguration" (
    "id" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "amountPerUnit" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentConfiguration_contentType_key" ON "public"."PaymentConfiguration"("contentType");
