-- Staging-only Cloudflare D1 schema. Not a PostgreSQL migration.
CREATE TABLE IF NOT EXISTS institutions(id TEXT PRIMARY KEY, name TEXT NOT NULL);
INSERT OR IGNORE INTO institutions(id,name) VALUES('IDR','КПУ Идризово'),('PRI','КПУ Прилеп'),('STI','КПУ Штип');
CREATE TABLE IF NOT EXISTS users(
 id TEXT PRIMARY KEY, institution_id TEXT NOT NULL REFERENCES institutions(id),
 username TEXT NOT NULL UNIQUE COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN ('educator','director','service_head','archivist','institution_admin')),
 display_name TEXT NOT NULL,
 password_hash TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1,
 must_change_password INTEGER NOT NULL DEFAULT 1,
 failed_attempts INTEGER NOT NULL DEFAULT 0,
 locked_until TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions(
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id),
 expires_at TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 institution_id TEXT NOT NULL REFERENCES institutions(id),
 actor_id TEXT NOT NULL,
 target_id TEXT,
 action TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS audit_institution_time ON audit_events(institution_id,created_at);
CREATE INDEX IF NOT EXISTS users_institution ON users(institution_id);
CREATE TABLE IF NOT EXISTS cases(
 id TEXT PRIMARY KEY,
 institution_id TEXT NOT NULL REFERENCES institutions(id),
 case_number TEXT NOT NULL UNIQUE,
 category TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('received','triage','assigned','forwarded','needs_info','answered','closed')),
 confidential INTEGER NOT NULL DEFAULT 0,
 assigned_to TEXT REFERENCES users(id),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cases_institution_status ON cases(institution_id,status);
