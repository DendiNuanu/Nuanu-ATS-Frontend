-- Add an explicit, nullable link from an employee to the application that led
-- to the hire. Existing employee records remain untouched and can be backfilled
-- only after an exact match has been reviewed.
ALTER TABLE "employees"
ADD COLUMN "candidateApplicationId" TEXT;

CREATE UNIQUE INDEX "employees_candidateApplicationId_key"
ON "employees"("candidateApplicationId");

CREATE INDEX "employees_candidateApplicationId_idx"
ON "employees"("candidateApplicationId");

ALTER TABLE "employees"
ADD CONSTRAINT "employees_candidateApplicationId_fkey"
FOREIGN KEY ("candidateApplicationId") REFERENCES "applications"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
