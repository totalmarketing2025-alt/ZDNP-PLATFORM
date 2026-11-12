-- Phase 9.1: trusted-backend-only transactional mutation.
-- This function accepts an OIDC subject ONLY from a server that already verified
-- issuer, audience, signature, expiration and MFA. Never expose DB credentials.
CREATE OR REPLACE FUNCTION auth_private.transition_case(p_subject text,p_case uuid,p_action text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
 v_actor public.staff_users%ROWTYPE;
 v_case public.cases%ROWTYPE;
 v_from text;
 v_to text;
 v_role text;
BEGIN
 IF p_subject IS NULL OR length(p_subject)<1 THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_actor FROM public.staff_users
 WHERE identity_provider_subject=p_subject AND enabled=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 CASE p_action
  WHEN 'assign' THEN v_from:='received';v_to:='assigned';v_role:='educator';
  WHEN 'forward' THEN v_from:='assigned';v_to:='forwarded';v_role:='educator';
  WHEN 'answer' THEN v_from:='forwarded';v_to:='answered';v_role:='director';
  WHEN 'close' THEN v_from:='answered';v_to:='closed';v_role:='director';
  ELSE RAISE EXCEPTION 'invalid action' USING ERRCODE='22023';
 END CASE;
 IF v_actor.role<>v_role THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_case FROM public.cases WHERE id=p_case FOR UPDATE;
 IF NOT FOUND OR v_case.institution_id<>v_actor.institution_id
 OR v_case.confidential OR v_case.status<>v_from THEN
  RAISE EXCEPTION 'forbidden or invalid state' USING ERRCODE='42501';
 END IF;
 IF p_action='assign' AND v_case.assigned_to IS NOT NULL THEN
  RAISE EXCEPTION 'already assigned' USING ERRCODE='23514';
 END IF;
 IF p_action='forward' AND v_case.assigned_to IS DISTINCT FROM v_actor.id THEN
  RAISE EXCEPTION 'not assigned to actor' USING ERRCODE='42501';
 END IF;
 UPDATE public.cases SET status=v_to,
 assigned_to=CASE WHEN p_action='assign' THEN v_actor.id ELSE assigned_to END,
 updated_at=now() WHERE id=p_case;
 INSERT INTO public.case_events(case_id,actor_id,event_type,event_metadata)
 VALUES(p_case,v_actor.id,p_action,jsonb_build_object('from',v_from,'to',v_to));
 RETURN v_to;
END;
$$;
REVOKE ALL ON FUNCTION auth_private.transition_case(text,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_private.transition_case(text,uuid,text) TO zdnp_app;
-- Security definer function must be owned by the trusted migration owner.
-- App role must not own it or have BYPASSRLS, DDL or direct write grants.
