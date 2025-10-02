-- AlterEnum
ALTER TYPE "public"."Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "public"."PromptTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" "public"."ContentType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "PromptTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LLMConfiguration" (
    "id" TEXT NOT NULL,
    "provider" "public"."LLMProvider" NOT NULL,
    "modelName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "maxTokens" INTEGER,
    "apiEndpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "LLMConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromptTemplate_name_key" ON "public"."PromptTemplate"("name");

-- AddForeignKey
ALTER TABLE "public"."PromptTemplate" ADD CONSTRAINT "PromptTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LLMConfiguration" ADD CONSTRAINT "LLMConfiguration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
