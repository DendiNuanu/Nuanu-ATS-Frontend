-- A SEEK/JobStreet listing must map to at most one internal vacancy.
-- PostgreSQL permits multiple NULL values in unique indexes, so postings that
-- have not yet received an external identifier remain valid.
CREATE UNIQUE INDEX "job_postings_channel_externalId_key"
ON "job_postings"("channel", "externalId");

CREATE UNIQUE INDEX "job_postings_channel_externalUrl_key"
ON "job_postings"("channel", "externalUrl");
