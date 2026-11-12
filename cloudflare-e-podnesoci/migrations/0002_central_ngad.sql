-- Phase 11.2: explicit centrally scoped NGAD flag, default deny.
-- Run AFTER 0001_initial.sql. Existing users remain institution-scoped.
ALTER TABLE users ADD COLUMN global_admin INTEGER NOT NULL DEFAULT 0 CHECK(global_admin IN (0,1));
CREATE TRIGGER IF NOT EXISTS central_admin_role_insert
BEFORE INSERT ON users
WHEN NEW.global_admin=1 AND (NEW.role<>'institution_admin' OR NEW.username<>'NGAD')
BEGIN SELECT RAISE(ABORT,'central admin requires NGAD institution_admin'); END;
CREATE TRIGGER IF NOT EXISTS central_admin_role_update
BEFORE UPDATE OF global_admin,role,username ON users
WHEN NEW.global_admin=1 AND (NEW.role<>'institution_admin' OR NEW.username<>'NGAD')
BEGIN SELECT RAISE(ABORT,'central admin requires NGAD institution_admin'); END;
-- No central admin is automatically created or enabled.
