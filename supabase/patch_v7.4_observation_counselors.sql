-- Patch v7.4: Conseillers en observation pour le département Intégration
-- Permet d'enregistrer des conseillers en phase d'observation sans compte d'accès à l'application
-- et sans obligation d'adresse e-mail.
-- À exécuter dans le Supabase SQL Editor de votre projet

CREATE TABLE IF NOT EXISTS public.integration_observation_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'integration_observation',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour accélérer le filtrage par église et statut
CREATE INDEX IF NOT EXISTS idx_integration_obs_church_id ON public.integration_observation_members(church_id);
CREATE INDEX IF NOT EXISTS idx_integration_obs_active ON public.integration_observation_members(active);

-- Activation de Row Level Security
ALTER TABLE public.integration_observation_members ENABLE ROW LEVEL SECURITY;

-- Politiques RLS conformes aux autres tables de collaboration de l'église
DROP POLICY IF EXISTS "integration_observation_members_select" ON public.integration_observation_members;
CREATE POLICY "integration_observation_members_select" ON public.integration_observation_members
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "integration_observation_members_insert" ON public.integration_observation_members;
CREATE POLICY "integration_observation_members_insert" ON public.integration_observation_members
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "integration_observation_members_update" ON public.integration_observation_members;
CREATE POLICY "integration_observation_members_update" ON public.integration_observation_members
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "integration_observation_members_delete" ON public.integration_observation_members;
CREATE POLICY "integration_observation_members_delete" ON public.integration_observation_members
  FOR DELETE TO anon, authenticated USING (true);

-- Migration des données historiques enregistrées temporairement dans pending_counselors
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'pending_counselors'
  ) THEN
    INSERT INTO public.integration_observation_members (church_id, first_name, last_name, email, role, created_at)
    SELECT 
      church_id, 
      first_name, 
      last_name, 
      CASE WHEN email LIKE 'obs_%@poimen.local' THEN NULL ELSE email END,
      role, 
      created_at
    FROM public.pending_counselors
    WHERE role = 'integration_observation'
    ON CONFLICT DO NOTHING;

    DELETE FROM public.pending_counselors WHERE role = 'integration_observation';
  END IF;
END $$;
