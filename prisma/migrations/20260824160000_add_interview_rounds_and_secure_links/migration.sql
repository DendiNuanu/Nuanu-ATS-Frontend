-- Add explicit round and date metadata to interviewer comments.
ALTER TABLE "interview_comments"
  ADD COLUMN "round" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "interviewDate" TIMESTAMP(3);

CREATE INDEX "interview_comments_applicationId_reviewer_type_round_idx"
  ON "interview_comments"("applicationId", "reviewer_type", "round");

-- Scope public interview access to a reviewer, application, and round.
CREATE TABLE "interview_links" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "reviewerRole" TEXT NOT NULL,
  "round" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "interview_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "interview_links_tokenHash_key"
  ON "interview_links"("tokenHash");
CREATE INDEX "interview_links_applicationId_reviewerId_reviewerRole_round_idx"
  ON "interview_links"("applicationId", "reviewerId", "reviewerRole", "round");
CREATE INDEX "interview_links_expiresAt_idx"
  ON "interview_links"("expiresAt");

ALTER TABLE "interview_links"
  ADD CONSTRAINT "interview_links_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "interview_links"
  ADD CONSTRAINT "interview_links_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
