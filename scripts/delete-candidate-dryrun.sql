-- Dry-run: count all records that reference this candidate before deletion.
-- Candidate: visualdendy / visualdendy@gmail.com
-- user_id: 8a38d8bb-4019-4c14-ab01-f6f9ef8fc53c
-- application_id: ba44015b-8b1d-4870-b20b-ca485b45824c

\set app_id '''ba44015b-8b1d-4870-b20b-ca485b45824c'''
\set user_id '''8a38d8bb-4019-4c14-ab01-f6f9ef8fc53c'''

\echo '=== Records linked to APPLICATION ==='
SELECT 'candidate_notes' AS tbl, count(*) FROM candidate_notes WHERE "applicationId" = :app_id
UNION ALL SELECT 'interview_comments', count(*) FROM interview_comments WHERE "applicationId" = :app_id
UNION ALL SELECT 'application_custom_fields', count(*) FROM application_custom_fields WHERE "applicationId" = :app_id
UNION ALL SELECT 'documents', count(*) FROM documents WHERE "applicationId" = :app_id
UNION ALL SELECT 'candidate_scores', count(*) FROM candidate_scores WHERE "applicationId" = :app_id
UNION ALL SELECT 'pipeline_stages', count(*) FROM pipeline_stages WHERE "applicationId" = :app_id
UNION ALL SELECT 'interviews', count(*) FROM interviews WHERE "applicationId" = :app_id
UNION ALL SELECT 'assessments', count(*) FROM assessments WHERE "applicationId" = :app_id
UNION ALL SELECT 'offers', count(*) FROM offers WHERE "applicationId" = :app_id
UNION ALL SELECT 'reference_checks', count(*) FROM reference_checks WHERE candidate_id = :app_id
UNION ALL SELECT 'reference_check_shares', count(*) FROM reference_check_shares WHERE application_id = :app_id
ORDER BY 1;

\echo ''
\echo '=== Records linked to USER (candidate) ==='
SELECT 'candidate_profiles' AS tbl, count(*) FROM candidate_profiles WHERE "userId" = :user_id
UNION ALL SELECT 'activity_logs', count(*) FROM activity_logs WHERE "userId" = :user_id
UNION ALL SELECT 'notifications', count(*) FROM notifications WHERE "userId" = :user_id
UNION ALL SELECT 'calendar_integrations', count(*) FROM calendar_integrations WHERE "userId" = :user_id
UNION ALL SELECT 'password_reset_tokens', count(*) FROM password_reset_tokens WHERE "userId" = :user_id
UNION ALL SELECT 'onboarding_tasks', count(*) FROM onboarding_tasks WHERE "employeeId" = :user_id
ORDER BY 1;

\echo ''
\echo '=== Cross-references: is this USER referenced by OTHER applications? ==='
SELECT 'as_hr_reviewer' AS ref, count(*) FROM applications WHERE "hrReviewerId" = :user_id
UNION ALL SELECT 'as_user1_reviewer', count(*) FROM applications WHERE "user1ReviewerId" = :user_id
UNION ALL SELECT 'as_user2_reviewer', count(*) FROM applications WHERE "user2ReviewerId" = :user_id
UNION ALL SELECT 'as_interviewer', count(*) FROM interviews WHERE "interviewerId" = :user_id
UNION ALL SELECT 'as_note_author', count(*) FROM candidate_notes WHERE "authorId" = :user_id
UNION ALL SELECT 'as_comment_author', count(*) FROM interview_comments WHERE "authorId" = :user_id
UNION ALL SELECT 'as_vacancy_creator', count(*) FROM vacancies WHERE "creatorId" = :user_id
UNION ALL SELECT 'as_vacancy_recruiter', count(*) FROM vacancies WHERE "recruiterId" = :user_id
UNION ALL SELECT 'as_refcheck_conductor', count(*) FROM reference_checks WHERE conducted_by = :user_id
UNION ALL SELECT 'as_employee_record', count(*) FROM employees WHERE "userId" = :user_id
ORDER BY 1;
