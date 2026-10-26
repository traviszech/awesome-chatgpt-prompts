-- AlterTable
ALTER TABLE "prompts" ADD COLUMN "trendingUntil" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "prompts_trendingUntil_idx" ON "prompts"("trendingUntil");
