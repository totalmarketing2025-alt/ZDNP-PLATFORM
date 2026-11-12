-- Run as database administrator after migrations 001 and 002.
-- Only a server-verified OIDC subject may be passed by trusted backend.
CREATE SCHEMA IF NOT EXISTS auth_private;
REVOKE ALL ON SCHEMA auth_private FROM PUBLIC;
CREATE OR REPLACE FUNCTION auth_private.lookup_staff(p_subject text)
RETURNS TABLE(id uuid,institution_id uuid,role text,display_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
 SELECT u.id,u.institution_id,u.role,u.display_name
 FROM public.staff_users u
 WHERE u.identity_provider_subject=p_subject AND u.enabled=true
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION auth_private.lookup_staff(text) FROM PUBLIC;
-- Execute only after creating a dedicated, restricted app DB role.
GRANT USAGE ON SCHEMA auth_private TO zdnp_app;
GRANT EXECUTE ON FUNCTION auth_private.lookup_staff(text) TO zdnp_app;
-- Review SECURITY DEFINER owner and search_path before production.
