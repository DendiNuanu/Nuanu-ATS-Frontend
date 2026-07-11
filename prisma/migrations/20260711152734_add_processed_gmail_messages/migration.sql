-- CreateTable
-- Tracks Gmail messages processed by scripts/import-gmail-candidates.ts.
-- This is the LOCAL dedup mechanism; the Gmail inbox is never modified
-- (read-only gmail.readonly scope only).
CREATE TABLE "processed_gmail_messages" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "subject" TEXT,
    "fromEmail" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "resultingApplicationId" TEXT,
    "candidateEmail" TEXT,
    "appliedPosition" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "processed_gmail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "processed_gmail_messages_gmailMessageId_key" ON "processed_gmail_messages"("gmailMessageId");

-- CreateIndex
CREATE INDEX "processed_gmail_messages_status_idx" ON "processed_gmail_messages"("status");

-- CreateIndex
CREATE INDEX "processed_gmail_messages_processedAt_idx" ON "processed_gmail_messages"("processedAt");
