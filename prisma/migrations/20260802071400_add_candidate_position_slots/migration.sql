-- CreateTable
CREATE TABLE "candidate_position_slots" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "position" TEXT NOT NULL,
    "departmentId" TEXT,
    "appliedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_position_slots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "candidate_position_slots_applicationId_kind_slotIndex_key"
ON "candidate_position_slots"("applicationId", "kind", "slotIndex");

-- CreateIndex
CREATE INDEX "candidate_position_slots_applicationId_idx"
ON "candidate_position_slots"("applicationId");

-- CreateIndex
CREATE INDEX "candidate_position_slots_departmentId_idx"
ON "candidate_position_slots"("departmentId");

-- AddForeignKey
ALTER TABLE "candidate_position_slots"
ADD CONSTRAINT "candidate_position_slots_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_position_slots"
ADD CONSTRAINT "candidate_position_slots_departmentId_fkey"
FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the legacy Applied For field as slot 0. Values that contain a JSON
-- array are expanded up to the supported three slots; plain strings stay slot 0.
INSERT INTO "candidate_position_slots" (
    "id", "applicationId", "kind", "slotIndex", "position", "departmentId",
    "appliedDate", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    a."id",
    'applied_for',
    slots.ordinality - 1,
    btrim(slots.position),
    a."departmentId",
    a."appliedAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "applications" a
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN a."appliedFor" IS NULL OR btrim(a."appliedFor") = '' THEN '[]'::jsonb
        WHEN btrim(a."appliedFor") ~ '^\[\s*"([^"\\]|\\.)*"(\s*,\s*"([^"\\]|\\.)*")*\s*\]$'
            THEN a."appliedFor"::jsonb
        ELSE jsonb_build_array(a."appliedFor")
    END
) WITH ORDINALITY AS slots(position, ordinality)
WHERE slots.ordinality <= 3 AND btrim(slots.position) <> '';

-- Backfill legacy Refer As values from candidate_profiles. These are linked by
-- Application.candidateId -> CandidateProfile.userId.
INSERT INTO "candidate_position_slots" (
    "id", "applicationId", "kind", "slotIndex", "position", "departmentId",
    "appliedDate", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    a."id",
    'refer_as',
    slots.ordinality - 1,
    btrim(slots.position),
    a."departmentId",
    a."appliedAt",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "applications" a
JOIN "candidate_profiles" cp ON cp."userId" = a."candidateId"
CROSS JOIN LATERAL jsonb_array_elements_text(
    CASE
        WHEN cp."referPosition" IS NULL OR btrim(cp."referPosition") = '' THEN '[]'::jsonb
        WHEN btrim(cp."referPosition") ~ '^\[\s*"([^"\\]|\\.)*"(\s*,\s*"([^"\\]|\\.)*")*\s*\]$'
            THEN cp."referPosition"::jsonb
        ELSE jsonb_build_array(cp."referPosition")
    END
) WITH ORDINALITY AS slots(position, ordinality)
WHERE slots.ordinality <= 3 AND btrim(slots.position) <> '';
