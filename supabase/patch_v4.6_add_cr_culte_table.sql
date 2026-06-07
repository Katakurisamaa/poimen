-- Migration: Add cr_culte table for Sunday Culte report
CREATE TABLE IF NOT EXISTS public.cr_culte (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  date_culte DATE NOT NULL DEFAULT CURRENT_DATE,
  salle_reception TEXT,
  effectif_global INTEGER DEFAULT 0,
  avec_coordonnees INTEGER DEFAULT 0,
  adultes_hommes INTEGER DEFAULT 0,
  adultes_femmes INTEGER DEFAULT 0,
  ados INTEGER DEFAULT 0,
  enfants INTEGER DEFAULT 0,
  aps INTEGER DEFAULT 0,
  piliers_12 TEXT DEFAULT '0',
  sans_eglise_locale INTEGER DEFAULT 0,
  avec_eglise_locale INTEGER DEFAULT 0,
  autre_eglise_icc TEXT DEFAULT '/',
  cadeaux_offerts INTEGER DEFAULT 0,
  salon_lounge_effectif INTEGER DEFAULT 0,
  bibles_distribuees INTEGER DEFAULT 0,
  cadeaux_recus INTEGER DEFAULT 0,
  souhait_pcnc INTEGER DEFAULT 0,
  souhait_suivi INTEGER DEFAULT 0,
  desir_servir INTEGER DEFAULT 0,
  rdv_pastoral INTEGER DEFAULT 0,
  cdm_souhait INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cr_culte ENABLE ROW LEVEL SECURITY;

-- Allow public read, write, update, delete
DROP POLICY IF EXISTS "cr_culte_public_select" ON public.cr_culte;
CREATE POLICY "cr_culte_public_select" ON public.cr_culte
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "cr_culte_public_insert" ON public.cr_culte;
CREATE POLICY "cr_culte_public_insert" ON public.cr_culte
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cr_culte_public_update" ON public.cr_culte;
CREATE POLICY "cr_culte_public_update" ON public.cr_culte
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "cr_culte_public_delete" ON public.cr_culte;
CREATE POLICY "cr_culte_public_delete" ON public.cr_culte
  FOR DELETE TO anon, authenticated USING (true);
