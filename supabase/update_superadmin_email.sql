-- =============================================================
-- Poimén Helper - Mise à jour de l'e-mail du Super Administrateur
-- =============================================================

-- 1. Mettre à jour l'e-mail de l'utilisateur admin dans la table d'authentification Supabase
UPDATE auth.users 
SET email = 'iccintegration2025@gmail.com', 
    email_confirmed_at = now() 
WHERE email = 'minkojunior400@gmail.com';

-- 2. Mettre à jour l'e-mail dans le profil public
UPDATE public.profiles 
SET email = 'iccintegration2025@gmail.com' 
WHERE email = 'minkojunior400@gmail.com';

-- 3. Mettre à jour la fonction get_user_role() pour intégrer le nouvel email
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  -- Priorité absolue à l'email admin pour éviter tout blocage
  SELECT COALESCE(
    CASE WHEN (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') THEN 'super_admin' END,
    (SELECT LOWER(REPLACE(role, ' ', '_')) FROM profiles WHERE id = auth.uid())
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 4. Mettre à jour les politiques de Row Level Security (RLS) pour utiliser le nouvel email

-- Table Profiles
DROP POLICY IF EXISTS "profiles_secure_read_policy" ON public.profiles;
CREATE POLICY "profiles_secure_read_policy" ON public.profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid()) OR
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable') OR
  (bergerie_id = get_user_bergerie())
);

DROP POLICY IF EXISTS "profiles_secure_update_policy" ON public.profiles;
CREATE POLICY "profiles_secure_update_policy" ON public.profiles FOR UPDATE TO authenticated
USING (
  (id = auth.uid()) OR
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

DROP POLICY IF EXISTS "profiles_secure_delete_policy" ON public.profiles;
CREATE POLICY "profiles_secure_delete_policy" ON public.profiles FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Table Churches
DROP POLICY IF EXISTS "churches_insert_policy" ON public.churches;
CREATE POLICY "churches_insert_policy" ON public.churches FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

DROP POLICY IF EXISTS "churches_update_policy" ON public.churches;
CREATE POLICY "churches_update_policy" ON public.churches FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (id = public.get_user_church() AND get_user_role() = 'integration_responsable')
);

DROP POLICY IF EXISTS "churches_delete_policy" ON public.churches;
CREATE POLICY "churches_delete_policy" ON public.churches FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Table Bergeries
DROP POLICY IF EXISTS "bergeries_insert_policy" ON public.bergeries;
CREATE POLICY "bergeries_insert_policy" ON public.bergeries FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable')
);

DROP POLICY IF EXISTS "bergeries_update_policy" ON public.bergeries;
CREATE POLICY "bergeries_update_policy" ON public.bergeries FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable') OR
  (id = get_user_bergerie() AND get_user_role() IN ('berger', 'second', 'second_du_berger'))
);

DROP POLICY IF EXISTS "bergeries_delete_policy" ON public.bergeries;
CREATE POLICY "bergeries_delete_policy" ON public.bergeries FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable')
);

-- Table Members
DROP POLICY IF EXISTS "members_integration_read_policy" ON public.members;
CREATE POLICY "members_integration_read_policy" ON public.members FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie())
);

DROP POLICY IF EXISTS "members_integration_manage_policy" ON public.members;
CREATE POLICY "members_integration_manage_policy" ON public.members FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller'))
);

-- Table Invites
DROP POLICY IF EXISTS "invites_integration_read_policy" ON public.invites;
CREATE POLICY "invites_integration_read_policy" ON public.invites FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie())
);

DROP POLICY IF EXISTS "invites_integration_manage_policy" ON public.invites;
CREATE POLICY "invites_integration_manage_policy" ON public.invites FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller'))
);

-- Table Pending Counselors
DROP POLICY IF EXISTS "Allow public select on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow public select on pending_counselors" ON public.pending_counselors FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second') OR
  (email = auth.jwt() ->> 'email')
);

DROP POLICY IF EXISTS "Allow authenticated insert on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow authenticated insert on pending_counselors" ON public.pending_counselors FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second')
);

DROP POLICY IF EXISTS "Allow public delete on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow public delete on pending_counselors" ON public.pending_counselors FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second')
);

-- Table Evangelisations
DROP POLICY IF EXISTS "evangelisations_read_policy" ON public.evangelisations;
CREATE POLICY "evangelisations_read_policy" ON public.evangelisations FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (created_by = auth.uid()) OR
  (public.check_user_same_church(auth.uid(), created_by))
);

DROP POLICY IF EXISTS "evangelisations_manage_policy" ON public.evangelisations;
CREATE POLICY "evangelisations_manage_policy" ON public.evangelisations FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (created_by = auth.uid())
);

-- Table Church Invitations
DROP POLICY IF EXISTS "invitations_manage_policy" ON public.church_invitations;
CREATE POLICY "invitations_manage_policy" ON public.church_invitations FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Recharger le schéma PostgREST
NOTIFY pgrst, 'reload schema';
