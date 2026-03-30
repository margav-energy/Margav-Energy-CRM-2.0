-- Lead Operations: SMS pause, priority, duplicate link
ALTER TABLE "Lead" ADD COLUMN "smsAutomationPaused" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "priority" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lead" ADD COLUMN "duplicateOfLeadId" TEXT;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_duplicateOfLeadId_fkey" FOREIGN KEY ("duplicateOfLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Lead_duplicateOfLeadId_idx" ON "Lead"("duplicateOfLeadId");
CREATE INDEX "Lead_smsAutomationPaused_idx" ON "Lead"("smsAutomationPaused");
