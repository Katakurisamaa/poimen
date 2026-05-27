-- =============================================================
-- Poimén Patch v2.0 - Département d'Intégration
-- =============================================================

-- 1. MODIFICATIONS DES TABLES

-- Ajout des champs d'intégration aux Églises
ALTER TABLE public.churches 
  ADD COLUMN IF NOT EXISTS integration_email TEXT,
  ADD COLUMN IF NOT EXISTS integration_access_code TEXT;

-- Rendre bergerie_id nullable sur invites
ALTER TABLE public.invites 
  ALTER COLUMN bergerie_id DROP NOT NULL;

-- Ajout des clés d'intégration sur invites
ALTER TABLE public.invites 
  ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Indexations pour des performances de recherche optimales
CREATE INDEX IF NOT EXISTS idx_invites_church ON public.invites(church_id);
CREATE INDEX IF NOT EXISTS idx_invites_assigned_to ON public.invites(assigned_to);

-- Table temporaire pour stocker les conseillers en attente d'enregistrement (Auth Bypass)
CREATE TABLE IF NOT EXISTS public.pending_counselors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  access_code TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'integration_conseiller',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour accélérer les requêtes d'authentification
CREATE INDEX IF NOT EXISTS idx_pending_counselors_email ON public.pending_counselors(email);

-- Mise à jour de la contrainte de rôle sur la table profiles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN (
    'super_admin',
    'berger',
    'coordonnateur',
    'responsable de brebi',
    'second du berger',
    'conseiller',
    'integration_responsable',
    'integration_second',
    'integration_conseiller'
  ));

-- 2. POLITIQUES RLS SUPPLÉMENTAIRES (Pour le profilage et la synchronisation via client anon)

DROP POLICY IF EXISTS "Allow anonymous insert on profiles" ON public.profiles;
CREATE POLICY "Allow anonymous insert on profiles" 
ON public.profiles FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow anonymous update on profiles" ON public.profiles;
CREATE POLICY "Allow anonymous update on profiles" 
ON public.profiles FOR UPDATE TO anon USING (true);

-- Politiques RLS pour pending_counselors
ALTER TABLE public.pending_counselors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public select on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow public select on pending_counselors" 
ON public.pending_counselors FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow authenticated insert on pending_counselors" 
ON public.pending_counselors FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public delete on pending_counselors" ON public.pending_counselors;
CREATE POLICY "Allow public delete on pending_counselors" 
ON public.pending_counselors FOR DELETE TO anon, authenticated USING (true);

-- Politiques RLS pour le profilage d'intégration (membres de l'équipe)
DROP POLICY IF EXISTS "profiles_integration_read" ON public.profiles;
CREATE POLICY "profiles_integration_read" ON public.profiles FOR SELECT TO authenticated
  USING (church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid()));

-- Politiques RLS sur invites pour les rôles d'intégration
DROP POLICY IF EXISTS "invites_integration_read" ON public.invites;
CREATE POLICY "invites_integration_read" ON public.invites FOR SELECT TO authenticated
  USING (
    church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
    )
  );

DROP POLICY IF EXISTS "invites_integration_manage" ON public.invites;
CREATE POLICY "invites_integration_manage" ON public.invites FOR ALL TO authenticated
  USING (
    church_id = (SELECT p.church_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()) IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
    )
  );

-- 3. RECHARGEMENT DU CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
