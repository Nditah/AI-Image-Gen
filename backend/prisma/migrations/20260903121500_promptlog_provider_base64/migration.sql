ALTER TABLE "PromptLog" RENAME COLUMN "imageUrl" TO "imageBase64";

ALTER TABLE "PromptLog" ADD COLUMN "provider" TEXT;

UPDATE "PromptLog"
SET "provider" = 'openai'
WHERE "provider" IS NULL;

ALTER TABLE "PromptLog" ALTER COLUMN "provider" SET NOT NULL;
