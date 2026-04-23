-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "qualifiedByQualifierId" TEXT;

-- CreateIndex
CREATE INDEX "Lead_qualifiedByQualifierId_idx" ON "Lead"("qualifiedByQualifierId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_qualifiedByQualifierId_fkey" FOREIGN KEY ("qualifiedByQualifierId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
