-- CreateEnum
CREATE TYPE "LeadProductLine" AS ENUM ('SOLAR', 'HEATING');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "productLine" "LeadProductLine";

-- CreateIndex
CREATE INDEX "Lead_productLine_idx" ON "Lead"("productLine");
