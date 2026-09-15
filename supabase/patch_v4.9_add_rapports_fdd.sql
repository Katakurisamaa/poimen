-- =============================================================
-- Migration: Add rapports_fdd table for Sunday Culte & Engagement Reporting
-- =============================================================

CREATE TABLE IF NOT EXISTS public.rapports_fdd (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bergerie_id UUID NOT NULL REFERENCES public.bergeries(id) ON DELETE CASCADE,
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  date_rapport DATE NOT NULL,
  nom_famille TEXT NOT NULL,
  nom_berger TEXT NOT NULL,
  logo_url TEXT,
  
  -- Membres
  nombre_total_membres INTEGER DEFAULT 0,
  repartition_hommes INTEGER DEFAULT 0,
  repartition_femmes INTEGER DEFAULT 0,
  
  -- Cultes (Culte 1, Culte 2, Culte en ligne)
  culte_1 INTEGER DEFAULT 0,
  culte_2 INTEGER DEFAULT 0,
  culte_en_ligne INTEGER DEFAULT 0,
  
  -- Absences et engagements
  absences_justifiees INTEGER DEFAULT 0,
  absences_non_justifiees INTEGER DEFAULT 0,
  star_en_service INTEGER DEFAULT 0,
  nombre_total_star INTEGER DEFAULT 0,
  reunion_hebdomadaire INTEGER DEFAULT 0,
  nouveaux_membres INTEGER DEFAULT 0,
  
  -- Disciples
  nombre_disciples INTEGER DEFAULT 0,
  taux_participation_disciples NUMERIC(5,2) DEFAULT 0,
  
  -- Textes et synthèse
  points_cles JSONB DEFAULT '[]'::jsonb,
  action_1 TEXT,
  action_2 TEXT,
  action_3 TEXT,
  verset_texte TEXT,
  verset_ref TEXT,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(bergerie_id, date_rapport)
);

-- Enable RLS
ALTER TABLE public.rapports_fdd ENABLE ROW LEVEL SECURITY;

-- Allow policies
DROP POLICY IF EXISTS "rapports_fdd_select_policy" ON public.rapports_fdd;
CREATE POLICY "rapports_fdd_select_policy" ON public.rapports_fdd
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rapports_fdd_insert_policy" ON public.rapports_fdd;
CREATE POLICY "rapports_fdd_insert_policy" ON public.rapports_fdd
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rapports_fdd_update_policy" ON public.rapports_fdd;
CREATE POLICY "rapports_fdd_update_policy" ON public.rapports_fdd
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "rapports_fdd_delete_policy" ON public.rapports_fdd;
CREATE POLICY "rapports_fdd_delete_policy" ON public.rapports_fdd
  FOR DELETE TO anon, authenticated USING (true);
