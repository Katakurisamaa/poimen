-- REVIEW AND TEST IN STAGING FIRST. Requires patches through v4.7.
-- This does NOT fix every legacy policy (notably churches/bergeries secrets).
-- Never reapply old permission patches after this migration.
BEGIN;

-- Browser users may read their contexts but must not grant or restore rights.
REVOKE INSERT, UPDATE, DELETE ON public.user_contexts FROM anon, authenticated;
DROP POLICY IF EXISTS user_contexts_update_own_active_state ON public.user_contexts;

-- A permissive legacy profile policy must not allow self-promotion, tenant
-- switching, email impersonation or restoring a disabled profile.
-- SECURITY INVOKER is intentional: current_user must remain the calling role.
CREATE OR REPLACE FUNCTION public.protect_profile_authority()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Profile provisioning requires a trusted server';
  END IF;
  IF ROW(NEW.id, NEW.email, NEW.role, NEW.church_id, NEW.bergerie_id, NEW.active)
     IS DISTINCT FROM ROW(OLD.id, OLD.email, OLD.role, OLD.church_id, OLD.bergerie_id, OLD.active) THEN
    RAISE EXCEPTION 'Account authority fields cannot be changed from the browser';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS protect_profile_authority ON public.profiles;
CREATE TRIGGER protect_profile_authority
BEFORE INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_authority();

-- Replace ALL report policies: permissive policies combine with OR.
DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cr_culte'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.cr_culte', item.policyname);
  END LOOP;
END;
$$;
ALTER TABLE public.cr_culte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cr_culte FROM anon;
CREATE POLICY cr_culte_scoped_access ON public.cr_culte
FOR ALL TO authenticated
USING (
  lower(auth.jwt() ->> 'email') = 'minkojunior400@gmail.com'
  OR EXISTS (
    SELECT 1 FROM public.user_contexts c
    WHERE c.user_id = auth.uid() AND c.active
      AND c.context_type = 'integration' AND c.church_id = cr_culte.church_id
      AND c.role IN ('integration_responsable', 'integration_second')
  )
)
WITH CHECK (
  lower(auth.jwt() ->> 'email') = 'minkojunior400@gmail.com'
  OR EXISTS (
    SELECT 1 FROM public.user_contexts c
    WHERE c.user_id = auth.uid() AND c.active
      AND c.context_type = 'integration' AND c.church_id = cr_culte.church_id
      AND c.role IN ('integration_responsable', 'integration_second')
  )
);
COMMIT;
