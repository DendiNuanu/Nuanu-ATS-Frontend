ALTER TABLE "applications"
ADD COLUMN "jobMatchStatus" TEXT NOT NULL DEFAULT 'matched',
ADD COLUMN "jobMatchReason" TEXT,
ADD COLUMN "externalJobId" TEXT,
ADD COLUMN "externalJobUrl" TEXT;

CREATE INDEX "applications_jobMatchStatus_idx" ON "applications"("jobMatchStatus");
CREATE INDEX "applications_externalJobId_idx" ON "applications"("externalJobId");
