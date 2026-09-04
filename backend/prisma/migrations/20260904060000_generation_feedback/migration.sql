-- CreateEnum
CREATE TYPE "FeedbackVerdict" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "GenerationFeedback" (
    "id" TEXT NOT NULL,
    "promptLogId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "verdict" "FeedbackVerdict" NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GenerationFeedback_promptLogId_key" ON "GenerationFeedback"("promptLogId");

-- CreateIndex
CREATE INDEX "GenerationFeedback_userId_idx" ON "GenerationFeedback"("userId");

-- CreateIndex
CREATE INDEX "GenerationFeedback_verdict_idx" ON "GenerationFeedback"("verdict");

-- CreateIndex
CREATE INDEX "GenerationFeedback_createdAt_idx" ON "GenerationFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "GenerationFeedback" ADD CONSTRAINT "GenerationFeedback_promptLogId_fkey" FOREIGN KEY ("promptLogId") REFERENCES "PromptLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationFeedback" ADD CONSTRAINT "GenerationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
