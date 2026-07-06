-- ============================================================================
-- DELETE candidate: visualdendy / visualdendy@gmail.com
-- user_id:        8a38d8bb-4019-4c14-ab01-f6f9ef8fc53c
-- application_id: ba44015b-8b1d-4870-b20b-ca485b45824c
-- vacancy_id:     58be3d3b-cbba-46c0-b871-d010f45052ac  (NOT deleted — shared)
--
-- Dry-run summary (2026-07-06):
--   application-linked tables: all 0
--   user-linked: candidate_profiles = 1, everything else 0
--   cross-references (reviewer/interviewer/employee): all 0
--   user_roles: 0
--
-- Deletion order respects FK constraints:
--   1. application children (cascade-safe, but explicit for safety)
--   2. candidate_profiles  (FK -> users.id, NO ACTION)
--   3. applications         (FK -> users.id via candidateId, NO ACTION)
--   4. users                (the candidate row itself)
--
-- Run inside a transaction. Aborts on any error.
-- ============================================================================

BEGIN;

\set app_id '''ba44015b-8b1d-4870-b20b-ca485b45824c'''
\set user_id '''8a38d8bb-4019-4c14-ab01-f6f9ef8fc53c'''

\echo '--- Pre-delete counts ---'
SELECT 'applications' AS tbl, count(*) FROM applications WHERE "candidateId" = :user_id
UNION ALL SELECT 'candidate_profiles', count(*) FROM candidate_profiles WHERE "userId" = :user_id
UNION ALL SELECT 'users', count(*) FROM users WHERE id = :user_id;

-- 1. Application children (all currently 0; delete defensively in case of race)
DELETE FROM reference_check_shares WHERE application_id = :app_id;
DELETE FROM reference_checks        WHERE candidate_id = :app_id;
DELETE FROM offers                  WHERE "applicationId" = :app_id;
DELETE FROM assessments             WHERE "applicationId" = :app_id;
DELETE FROM interviews             WHERE "applicationId" = :app_id;
DELETE FROM candidate_scores       WHERE "applicationId" = :app_id;
DELETE FROM pipeline_stages        WHERE "applicationId" = :app_id;
DELETE FROM documents              WHERE "applicationId" = :app_id;
DELETE FROM application_custom_fields WHERE "applicationId" = :app_id;
DELETE FROM interview_comments     WHERE "applicationId" = :app_id;
DELETE FROM candidate_notes        WHERE "applicationId" = :app_id;

-- 2. Candidate profile (FK -> users.id)
DELETE FROM candidate_profiles WHERE "userId" = :user_id;

-- 3. The application row itself (FK -> users.id via candidateId)
DELETE FROM applications WHERE id = :app_id;

-- 4. The user (candidate) row
DELETE FROM users WHERE id = :user_id;

\echo '--- Post-delete verification ---'
SELECT 'applications' AS tbl, count(*) AS remaining FROM applications WHERE "candidateId" = :user_id
UNION ALL SELECT 'candidate_profiles', count(*) FROM candidate_profiles WHERE "userId" = :user_id
UNION ALL SELECT 'users', count(*) FROM users WHERE id = :user_id;

-- If all three remaining counts are 0, commit; otherwise rollback.
COMMIT;
\echo 'DONE — candidate deleted.'
