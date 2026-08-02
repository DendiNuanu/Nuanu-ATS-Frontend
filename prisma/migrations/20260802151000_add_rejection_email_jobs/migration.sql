CREATE TABLE "rejection_email_jobs" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "rejectionType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "rejection_email_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "rejection_email_jobs_applicationId_key"
ON "rejection_email_jobs"("applicationId");

CREATE INDEX "rejection_email_jobs_status_nextAttemptAt_idx"
ON "rejection_email_jobs"("status", "nextAttemptAt");

ALTER TABLE "rejection_email_jobs"
ADD CONSTRAINT "rejection_email_jobs_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
