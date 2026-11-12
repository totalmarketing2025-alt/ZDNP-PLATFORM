-- Phase 11: persistent local-credential staff and audit foundation.
-- No password secrets or real accounts are seeded by this migration.
CREATE TABLE admin_credentials (
 staff_id uuid PRIMARY KEY REFERENCES staff_users(id) ON DELETE RESTRICT,
 username text NOT NULL UNIQUE CHECK (username ~ '^[A-Za-z0-9_.-]{3,32}$'),
 password_hash text NOT NULL CHECK (length(password_hash)>40),
 must_change_password boolean NOT NULL DEFAULT true,
 password_changed_at timestamptz NOT NULL DEFAULT now(),
 failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts>=0),
 locked_until timestamptz
);
CREATE TABLE admin_sessions (
 token_hash text PRIMARY KEY CHECK (length(token_hash)=64),
 staff_id uuid NOT NULL REFERENCES staff_users(id),
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_sessions_staff_idx ON admin_sessions(staff_id);
CREATE TABLE admin_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 institution_id uuid NOT NULL REFERENCES institutions(id),
 actor_id uuid REFERENCES staff_users(id),
 target_id uuid REFERENCES staff_users(id),
 action text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_tenant_idx ON admin_audit(institution_id,created_at DESC);
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit FORCE ROW LEVEL SECURITY;
-- No policies or direct grants for the ordinary application role.
-- Authentication must use an isolated, trusted server-side service and
-- narrowly scoped reviewed SQL functions before enabling live access.
