-- ZDNP e-PODNESOCI: PostgreSQL draft schema. NOT deployed.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE institutions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE CHECK (code IN ('IDR','PRI','STI')),
 name text NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
CREATE TABLE staff_users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES institutions(id),
 email text NOT NULL,
 display_name text NOT NULL,
 role text NOT NULL CHECK (role IN ('educator','director','institution_admin','service_head')),
 identity_provider_subject text UNIQUE,
 enabled boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (institution_id,email)
);
CREATE TABLE cases (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 institution_id uuid NOT NULL REFERENCES institutions(id),
 case_number text NOT NULL UNIQUE,
 category text NOT NULL CHECK (category IN ('request','petition','question','complaint','other')),
 confidential boolean NOT NULL DEFAULT false,
 subject text NOT NULL,
 encrypted_payload bytea NOT NULL,
 status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','triage','assigned','forwarded','needs_info','answered','closed')),
 assigned_to uuid REFERENCES staff_users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE case_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 actor_id uuid REFERENCES staff_users(id),
 event_type text NOT NULL,
 event_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE case_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 case_id uuid NOT NULL REFERENCES cases(id),
 storage_key text NOT NULL UNIQUE,
 content_type text NOT NULL,
 bytes bigint NOT NULL CHECK (bytes > 0),
 sha256 text NOT NULL,
 malware_scan_status text NOT NULL DEFAULT 'pending' CHECK (malware_scan_status IN ('pending','clean','blocked')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE case_grants (
 case_id uuid NOT NULL REFERENCES cases(id),
 user_id uuid NOT NULL REFERENCES staff_users(id),
 granted_by uuid NOT NULL REFERENCES staff_users(id),
 expires_at timestamptz NOT NULL,
 PRIMARY KEY(case_id,user_id)
);
CREATE INDEX cases_institution_status_idx ON cases(institution_id,status,created_at DESC);
CREATE INDEX events_case_time_idx ON case_events(case_id,occurred_at DESC);
-- IMPORTANT: app must enforce tenant boundaries and confidential complaint routing.
-- RLS policies, encryption key management and verified identity provider required before any live deployment.
INSERT INTO institutions(code,name) VALUES
 ('IDR','КПУ Идризово'),('PRI','КПУ Прилеп'),('STI','КПУ Штип');
