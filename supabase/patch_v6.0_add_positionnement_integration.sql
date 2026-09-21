-- Migration: Add positionnement_integration table for Sunday Service Seating & Post assignments
CREATE TABLE IF NOT EXISTS public.positionnement_integration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  date_culte DATE NOT NULL, -- e.g. '2026-09-20'
  coordination_generale TEXT DEFAULT '',
  cleaning_notice TEXT DEFAULT 'ATTENTION: TOUS LES CONSEILLERS EN SERVICE DOIVENT ASSURER LE NETTOYAGE APRÈS LE SERVICE',
  seats JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(church_id, date_culte)
);

-- Enable RLS
ALTER TABLE public.positionnement_integration ENABLE ROW LEVEL SECURITY;

-- Policies (consistent with other church reporting and collaboration tables)
DROP POLICY IF EXISTS "positionnement_integration_select" ON public.positionnement_integration;
CREATE POLICY "positionnement_integration_select" ON public.positionnement_integration
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "positionnement_integration_insert" ON public.positionnement_integration;
CREATE POLICY "positionnement_integration_insert" ON public.positionnement_integration
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "positionnement_integration_update" ON public.positionnement_integration;
CREATE POLICY "positionnement_integration_update" ON public.positionnement_integration
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "positionnement_integration_delete" ON public.positionnement_integration;
CREATE POLICY "positionnement_integration_delete" ON public.positionnement_integration
  FOR DELETE TO anon, authenticated USING (true);
