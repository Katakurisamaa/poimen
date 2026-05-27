-- =============================================================
-- Poimén Patch v2.1 - Fix RLS Recursion on Profiles & Invites
-- =============================================================

-- 1. Create a SECURITY DEFINER helper function to bypass RLS for profiles church_id query
CREATE OR REPLACE FUNCTION public.get_user_church()
RETURNS UUID AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Create a SECURITY DEFINER helper function to bypass RLS for profiles role query
CREATE OR REPLACE FUNCTION public.get_user_role_from_profile()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Drop the recursive RLS select policies on profiles
DROP POLICY IF EXISTS "profiles_integration_read" ON public.profiles;

-- 4. Re-create the SELECT policy securely without recursion
CREATE POLICY "profiles_integration_read" ON public.profiles FOR SELECT TO authenticated
  USING (church_id = public.get_user_church());

-- 5. Re-create SELECT/ALL policies on invites using the definer helper
DROP POLICY IF EXISTS "invites_integration_read" ON public.invites;
CREATE POLICY "invites_integration_read" ON public.invites FOR SELECT TO authenticated
  USING (
    church_id = public.get_user_church()
    AND (
      public.get_user_role_from_profile() IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invites_integration_manage" ON public.invites;
CREATE POLICY "invites_integration_manage" ON public.invites FOR ALL TO authenticated
  USING (
    church_id = public.get_user_church()
    AND (
      public.get_user_role_from_profile() IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
    )
  );

-- 6. Add/Update a robust INSERT policy for profiles to allow authenticated users to self-heal their own profile
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated 
  WITH CHECK (id = auth.uid());

-- 7. Add/Update a robust SELECT policy for profiles to let authenticated users read their own profile
DROP POLICY IF EXISTS "profiles_read_own" ON public.profiles;
CREATE POLICY "profiles_read_own" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

-- 8. Add/Update a robust UPDATE policy for profiles to let authenticated users update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Reload cache
NOTIFY pgrst, 'reload schema';
