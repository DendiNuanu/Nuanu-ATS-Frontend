ALTER TABLE "interview_comments"
  ADD COLUMN IF NOT EXISTS "interviewer_name" TEXT,
  ADD COLUMN IF NOT EXISTS "interview_position" TEXT;
