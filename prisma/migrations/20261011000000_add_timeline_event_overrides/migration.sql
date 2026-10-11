CREATE TABLE IF NOT EXISTS "timeline_event_overrides" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "sourceAt" TIMESTAMPTZ NOT NULL,
    "displayAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "updatedById" TEXT,
    CONSTRAINT "timeline_event_overrides_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "timeline_event_overrides_applicationId_fkey"
        FOREIGN KEY ("applicationId") REFERENCES "applications"("id")
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "timeline_event_overrides_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timeline_event_overrides_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "users"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "timeline_event_overrides_applicationId_eventType_eventKey_key"
    ON "timeline_event_overrides" ("applicationId", "eventType", "eventKey");

CREATE INDEX IF NOT EXISTS "timeline_event_overrides_applicationId_eventType_idx"
    ON "timeline_event_overrides" ("applicationId", "eventType");

CREATE INDEX IF NOT EXISTS "timeline_event_overrides_displayAt_idx"
    ON "timeline_event_overrides" ("displayAt");
