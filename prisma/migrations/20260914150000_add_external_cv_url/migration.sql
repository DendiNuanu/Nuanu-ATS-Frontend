-- Task 2 "Upload CV via Link": store the original external CV link
-- (Google Drive, Notion, Behance, personal site, …) verbatim on the
-- candidate profile so it can be displayed as a clickable link on the
-- candidate detail page, even when the file itself could not be fetched.
ALTER TABLE "candidate_profiles" ADD COLUMN "externalCvUrl" TEXT;
