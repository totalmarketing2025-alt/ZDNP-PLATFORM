-- Phase 6: PostgreSQL tenant isolation. Apply after 001_initial.sql.
-- App DB role must NOT own tables, be superuser or have BYPASSRLS.
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users FORCE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases FORCE ROW LEVEL SECURITY;
ALTER TABLE case_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_events FORCE ROW LEVEL SECURITY;
ALTER TABLE case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_documents FORCE ROW LEVEL SECURITY;
ALTER TABLE case_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_grants FORCE ROW LEVEL SECURITY;

-- Verified server must set transaction-local institution and staff identity.
-- A direct SQL client with the app role is trusted; NEVER expose it to end users.
CREATE POLICY staff_institution_scope ON staff_users
 FOR SELECT USING (institution_id = NULLIF(current_setting('app.institution_id',true),'')::uuid
 AND id = NULLIF(current_setting('app.staff_id',true),'')::uuid);

CREATE POLICY cases_staff_read ON cases FOR SELECT USING (
 institution_id = NULLIF(current_setting('app.institution_id',true),'')::uuid
 AND confidential = false
 AND EXISTS (
   SELECT 1 FROM staff_users u WHERE u.id = NULLIF(current_setting('app.staff_id',true),'')::uuid
   AND u.enabled AND u.institution_id = cases.institution_id
   AND (
     (u.role='educator' AND (cases.assigned_to IS NULL OR cases.assigned_to=u.id))
     OR (u.role='director' AND cases.status IN ('forwarded','answered','closed'))
   )
 )
);
-- Deliberately no INSERT/UPDATE/DELETE policies for app role yet.
-- All mutations and confidential case access are denied until separately designed.
CREATE POLICY case_events_read ON case_events FOR SELECT USING (
 EXISTS (SELECT 1 FROM cases c WHERE c.id=case_events.case_id)
);
CREATE POLICY case_documents_read ON case_documents FOR SELECT USING (
 malware_scan_status='clean' AND EXISTS (SELECT 1 FROM cases c WHERE c.id=case_documents.case_id)
);
-- No access grants policy until a formally reviewed exception workflow exists.
-- GRANT privileges to a non-owner, non-BYPASSRLS application role separately.
