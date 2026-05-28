-- =============================================================
-- ICC Famille de Disciple — Poimén : DATABASE SCHEMA v1.3
-- =============================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLES STRUCTURE
CREATE TABLE IF NOT EXISTS churches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'Belgique',
  access_code TEXT,
  logo_url TEXT,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bergeries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  berger_id UUID,
  coordonnateur_id UUID,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  church_id UUID REFERENCES churches(id) ON DELETE SET NULL,
  bergerie_id UUID REFERENCES bergeries(id) ON DELETE SET NULL,
  language TEXT DEFAULT 'fr',
  avatar_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bergerie_id UUID NOT NULL REFERENCES bergeries(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  civility TEXT NOT NULL CHECK (civility IN ('M.','Mme.', 'Mlle.')),
  age TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'Brebi',
  responsible TEXT,
  is_conseiller BOOLEAN DEFAULT false,
  attendance JSONB DEFAULT '{}',
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bergerie_id UUID NOT NULL REFERENCES bergeries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('culte','priere','evangelisation','cdm','seminaire','bapteme','autre')),
  date DATE NOT NULL,
  time TIME,
  location TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bergerie_id UUID NOT NULL REFERENCES bergeries(id) ON DELETE CASCADE,
  civility TEXT NOT NULL CHECK (civility IN ('M.','Mme.', 'Mlle.')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age TEXT NOT NULL,
  phone TEXT,
  status TEXT,
  attendance JSONB DEFAULT '{}',
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS SECURITY FUNCTIONS (Bunker Mode)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  -- Priorité absolue à l'email admin pour éviter tout blocage
  SELECT COALESCE(
    CASE WHEN (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') THEN 'super_admin' END,
    (SELECT LOWER(REPLACE(role, ' ', '_')) FROM profiles WHERE id = auth.uid())
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_bergerie()
RETURNS UUID AS $$
  SELECT bergerie_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 4. RLS POLICIES (Ultra-Robust)

-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
CREATE POLICY "profiles_read_own" ON profiles FOR SELECT USING (id = auth.uid());
DROP POLICY IF EXISTS "super_admin_all" ON profiles;
CREATE POLICY "super_admin_all" ON profiles FOR ALL USING (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR (get_user_role() = 'super_admin') OR (id = auth.uid())
);

-- MEMBERS
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members_access_policy" ON members;
DROP POLICY IF EXISTS "members_read_policy" ON members;

-- Lecteurs (Tout le monde dans la bergerie)
CREATE POLICY "members_read_policy" ON members FOR SELECT
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie())
  );

-- Gestionnaires (Berger, Second, Responsable, etc.)
CREATE POLICY "members_manage_policy" ON members FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','responsable','coordonnateur','second_du_berger','responsable_de_brebi', 'conseiller'))
  );

-- ACTIVITIES
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_access_policy" ON activities;
CREATE POLICY "activities_read_policy" ON activities FOR SELECT
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie())
  );

CREATE POLICY "activities_manage_policy" ON activities FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','responsable','coordonnateur','second_du_berger','responsable_de_brebi', 'conseiller'))
  );

-- INVITES
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invites_access_policy" ON invites;
CREATE POLICY "invites_read_policy" ON invites FOR SELECT
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie())
  );

CREATE POLICY "invites_manage_policy" ON invites FOR ALL
  USING (
    (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com') OR 
    (get_user_role() = 'super_admin') OR 
    (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','responsable','coordonnateur','second_du_berger','responsable_de_brebi', 'conseiller'))
  );

-- 5. AUTOMATION: Sync leaders to members table
CREATE UNIQUE INDEX IF NOT EXISTS members_email_bergerie_idx ON public.members (email, bergerie_id) WHERE (email IS NOT NULL AND email <> '' AND archived = false);

CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bergerie_id IS NOT NULL THEN
    INSERT INTO public.members (bergerie_id, civility, first_name, last_name, email, status)
    VALUES (
      NEW.bergerie_id,
      'M.',
      split_part(NEW.display_name, ' ', 1),
      COALESCE(split_part(NEW.display_name, ' ', 2), ''),
      NEW.email,
      CASE 
        WHEN NEW.role ILIKE '%berger%' THEN 'Berger'
        WHEN NEW.role ILIKE '%second%' THEN 'Second'
        WHEN NEW.role ILIKE '%responsable%' THEN 'Responsable'
        WHEN NEW.role ILIKE '%conseiller%' THEN 'Conseiller'
        ELSE 'Brebi'
      END,
      NEW.role ILIKE '%conseiller%'
    )
    ON CONFLICT (email, bergerie_id) WHERE (email IS NOT NULL AND email <> '' AND archived = false) DO UPDATE 
    SET status = EXCLUDED.status,
        is_conseiller = EXCLUDED.is_conseiller;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_sync_profile_to_member ON public.profiles;
CREATE TRIGGER tr_sync_profile_to_member
  AFTER INSERT OR UPDATE OF bergerie_id, role, display_name ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_to_member();

-- 6. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
