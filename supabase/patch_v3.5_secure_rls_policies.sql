-- =============================================================
-- Poimén Patch v3.5 - Hardening Database Security (Bunker Mode)
-- =============================================================

-- 1. ENFORCE RLS GLOBALLY
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bergeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_counselors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evangelisations ENABLE ROW LEVEL SECURITY;

-- 2. DROP ALL VULNERABLE ANONYMOUS POLICIES

-- Churches
DROP POLICY IF EXISTS "Allow anonymous select on churches" ON public.churches;
DROP POLICY IF EXISTS "Allow anonymous insert on churches" ON public.churches;
DROP POLICY IF EXISTS "Allow anonymous update on churches" ON public.churches;
DROP POLICY IF EXISTS "Allow anonymous delete on churches" ON public.churches;
DROP POLICY IF EXISTS "super_admin_all_churches" ON public.churches;
DROP POLICY IF EXISTS "super_admin_all_churches_v2" ON public.churches;

-- Bergeries
DROP POLICY IF EXISTS "Allow anonymous update on bergeries" ON public.bergeries;
DROP POLICY IF EXISTS "Allow anonymous delete on bergeries" ON public.bergeries;
DROP POLICY IF EXISTS "super_admin_all_bergeries" ON public.bergeries;
DROP POLICY IF EXISTS "super_admin_all_bergeries_v2" ON public.bergeries;

-- Profiles
DROP POLICY IF EXISTS "Allow anonymous select on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous insert on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow anonymous update on profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow public select on profiles" ON public.profiles;

-- Members
DROP POLICY IF EXISTS "Allow anonymous select on members" ON public.members;
DROP POLICY IF EXISTS "Allow anonymous insert on members" ON public.members;
DROP POLICY IF EXISTS "Allow anonymous update on members" ON public.members;

-- Invites
DROP POLICY IF EXISTS "Allow anonymous select on invites" ON public.invites;
DROP POLICY IF EXISTS "Allow anonymous insert on invites" ON public.invites;
DROP POLICY IF EXISTS "Allow anonymous update on invites" ON public.invites;

-- Pending Counselors
DROP POLICY IF EXISTS "Allow public select on pending_counselors" ON public.pending_counselors;
DROP POLICY IF EXISTS "Allow authenticated insert on pending_counselors" ON public.pending_counselors;
DROP POLICY IF EXISTS "Allow public delete on pending_counselors" ON public.pending_counselors;

-- Evangelisations
DROP POLICY IF EXISTS "evangelisations_read_policy" ON public.evangelisations;
DROP POLICY IF EXISTS "evangelisations_manage_policy" ON public.evangelisations;

-- New Policies Drop (for idempotency)
DROP POLICY IF EXISTS "churches_select_policy" ON public.churches;
DROP POLICY IF EXISTS "churches_insert_policy" ON public.churches;
DROP POLICY IF EXISTS "churches_update_policy" ON public.churches;
DROP POLICY IF EXISTS "churches_delete_policy" ON public.churches;

DROP POLICY IF EXISTS "bergeries_select_policy" ON public.bergeries;
DROP POLICY IF EXISTS "bergeries_insert_policy" ON public.bergeries;
DROP POLICY IF EXISTS "bergeries_update_policy" ON public.bergeries;
DROP POLICY IF EXISTS "bergeries_delete_policy" ON public.bergeries;

DROP POLICY IF EXISTS "profiles_secure_read_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_secure_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_secure_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_secure_delete_policy" ON public.profiles;

DROP POLICY IF EXISTS "members_integration_read_policy" ON public.members;
DROP POLICY IF EXISTS "members_integration_manage_policy" ON public.members;

DROP POLICY IF EXISTS "invites_integration_read_policy" ON public.invites;
DROP POLICY IF EXISTS "invites_integration_manage_policy" ON public.invites;


-- 2.5 DEFINE SECURITY DEFINER HELPERS (DEFINED BEFORE RLS POLICIES TO PREVENT BOOTSTRAP ERRORS)
CREATE OR REPLACE FUNCTION public.get_user_church()
RETURNS UUID AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.check_user_same_church(p_user_id UUID, p_creator_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p1
    JOIN public.profiles p2 ON p1.church_id = p2.church_id
    WHERE p1.id = p_user_id AND p2.id = p_creator_id
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION verify_church_code(p_church_id UUID, p_code TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.churches
    WHERE id = p_church_id AND access_code = p_code AND archived = false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;


---- 3. DEFINE SECURE NEW POLICIES (AUTHENTICATED ONLY)

-- Churches
CREATE POLICY "churches_select_policy" ON public.churches FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "churches_insert_policy" ON public.churches FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

CREATE POLICY "churches_update_policy" ON public.churches FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (id = public.get_user_church() AND get_user_role() = 'integration_responsable')
);

CREATE POLICY "churches_delete_policy" ON public.churches FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Bergeries
CREATE POLICY "bergeries_select_policy" ON public.bergeries FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "bergeries_insert_policy" ON public.bergeries FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable')
);

CREATE POLICY "bergeries_update_policy" ON public.bergeries FOR UPDATE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable') OR
  (id = get_user_bergerie() AND get_user_role() IN ('berger', 'second', 'second_du_berger'))
);

CREATE POLICY "bergeries_delete_policy" ON public.bergeries FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable')
);

-- Profiles
CREATE POLICY "profiles_secure_read_policy" ON public.profiles FOR SELECT TO authenticated
USING (
  (id = auth.uid()) OR
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR
  (church_id = public.get_user_church() AND get_user_role() = 'integration_responsable') OR
  (bergerie_id = get_user_bergerie())
);

CREATE POLICY "profiles_secure_insert_policy" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_secure_update_policy" ON public.profiles FOR UPDATE TO authenticated
USING (
  (id = auth.uid()) OR
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

CREATE POLICY "profiles_secure_delete_policy" ON public.profiles FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Members
CREATE POLICY "members_integration_read_policy" ON public.members FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie())
);

CREATE POLICY "members_integration_manage_policy" ON public.members FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller'))
);

-- Invites
CREATE POLICY "invites_integration_read_policy" ON public.invites FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie())
);

CREATE POLICY "invites_integration_manage_policy" ON public.invites FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church())) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller'))
);

-- Pending Counselors
CREATE POLICY "Allow public select on pending_counselors" 
ON public.pending_counselors FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second') OR
  (email = auth.jwt() ->> 'email')
);

CREATE POLICY "Allow authenticated insert on pending_counselors" 
ON public.pending_counselors FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second')
);

CREATE POLICY "Allow public delete on pending_counselors" 
ON public.pending_counselors FOR DELETE TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() = 'integration_responsable' OR get_user_role() = 'integration_second')
);

-- Evangelisations
CREATE POLICY "evangelisations_read_policy" ON public.evangelisations FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (created_by = auth.uid()) OR
  (public.check_user_same_church(auth.uid(), created_by))
);

CREATE POLICY "evangelisations_manage_policy" ON public.evangelisations FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (created_by = auth.uid())
);


-- 5. CRYPTOGRAPHIC CHURCH INVITATIONS
CREATE TABLE IF NOT EXISTS public.church_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc'::text, now()) + interval '48 hours'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_by_church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL
);

ALTER TABLE public.church_invitations ENABLE ROW LEVEL SECURITY;

-- Drop policies if they exist (only safe now that table exists)
DROP POLICY IF EXISTS "invitations_select_policy" ON public.church_invitations;
DROP POLICY IF EXISTS "invitations_manage_policy" ON public.church_invitations;

CREATE POLICY "invitations_select_policy" ON public.church_invitations FOR SELECT TO anon, authenticated
USING (used = false AND expires_at > now());

CREATE POLICY "invitations_manage_policy" ON public.church_invitations FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- REFRESH SCHEMA FOR POSTGREST
NOTIFY pgrst, 'reload schema';
