-- AlterTable
ALTER TABLE "PromptLog" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER,
ADD COLUMN IF NOT EXISTS "modelName" TEXT,
ADD COLUMN IF NOT EXISTS "imageSize" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PromptLog_durationMs_idx" ON "PromptLog"("durationMs");
