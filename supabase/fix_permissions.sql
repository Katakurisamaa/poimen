-- =============================================================
-- PATCH: FIX RLS PERMISSIONS & ASSIGNMENT FOR INVITES
-- =============================================================

-- 1. Update get_user_role to use members table instead of profiles
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    CASE WHEN (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') THEN 'super_admin' END,
    (
      SELECT LOWER(REPLACE(status, ' ', '_')) 
      FROM public.members 
      WHERE email = (auth.jwt() ->> 'email')
      LIMIT 1
    )
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 2. Update get_user_bergerie to use members table instead of profiles
CREATE OR REPLACE FUNCTION get_user_bergerie()
RETURNS UUID AS $$
  SELECT bergerie_id 
  FROM public.members 
  WHERE email = (auth.jwt() ->> 'email')
  LIMIT 1
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 3. Update invites_access_policy to support more role variants
-- This allows both normalized names ('second') and legacy names ('second_du_berger')
DROP POLICY IF EXISTS "invites_access_policy" ON public.invites;
CREATE POLICY "invites_access_policy" ON public.invites FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (
      bergerie_id = get_user_bergerie() AND 
      get_user_role() IN ('berger','coordonnateur','second','second_du_berger','responsable','responsable_de_brebi')
    )
  );

-- 4. Apply same logic to members and activities for consistency
DROP POLICY IF EXISTS "members_access_policy" ON public.members;
CREATE POLICY "members_access_policy" ON public.members FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (
      bergerie_id = get_user_bergerie() AND 
      get_user_role() IN ('berger','coordonnateur','second','second_du_berger','responsable','responsable_de_brebi')
    )
  );

DROP POLICY IF EXISTS "activities_access_policy" ON public.activities;
CREATE POLICY "activities_access_policy" ON public.activities FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (
      bergerie_id = get_user_bergerie() AND 
      get_user_role() IN ('berger','coordonnateur','second','second_du_berger','responsable','responsable_de_brebi')
    )
  );

-- Reload schema
NOTIFY pgrst, 'reload schema';
