-- =============================================================
-- Poimén Patch v4.4 - Fix Guest Assignment & Visibility
-- =============================================================

-- 1. Drop existing policies
DROP POLICY IF EXISTS "profiles_secure_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "invites_integration_read_policy" ON public.invites;
DROP POLICY IF EXISTS "invites_integration_manage_policy" ON public.invites;

-- 2. Re-create Profiles secure read policy
-- This allows both integration_responsable and integration_second to read profiles of users in their church
CREATE POLICY "profiles_secure_read_policy" ON public.profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid()) OR
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR
  (church_id = public.get_user_church() AND get_user_role() IN ('integration_responsable', 'integration_second')) OR
  (bergerie_id = get_user_bergerie())
);

-- 3. Re-create Invites integration read policy
-- This allows:
-- - super admins and system integration email
-- - integration leaders to view invites of their church (even if they have no bergerie yet)
-- - assigned counselors (assigned_to = auth.uid())
-- - creators of the invite (created_by = auth.uid())
-- - anyone in the same bergerie (bergerie_id = get_user_bergerie())
CREATE POLICY "invites_integration_read_policy" ON public.invites FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND (church_id = public.get_user_church() OR bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church()))) OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid()) OR
  (bergerie_id = get_user_bergerie())
);

-- 4. Re-create Invites integration manage policy
-- This allows:
-- - super admins and system integration email
-- - integration leaders to manage invites of their church (even if they have no bergerie yet)
-- - assigned counselors (assigned_to = auth.uid())
-- - creators of the invite (created_by = auth.uid())
-- - anyone in the same bergerie with an eligible role
CREATE POLICY "invites_integration_manage_policy" ON public.invites FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND (church_id = public.get_user_church() OR bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church()))) OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid()) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller'))
);

-- 5. Reload Schema cache
NOTIFY pgrst, 'reload schema';
