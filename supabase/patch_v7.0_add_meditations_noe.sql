-- Migration: Add meditations_noe table for weekly meditation planning (Famille de Noé)
CREATE TABLE IF NOT EXISTS public.meditations_noe (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  bergerie_id UUID REFERENCES public.bergeries(id) ON DELETE SET NULL,
  week_key DATE NOT NULL, -- Monday date of the week e.g. '2026-09-21'
  week_label TEXT NOT NULL, -- e.g. 'Semaine du 21 septembre'
  livre_theme TEXT NOT NULL DEFAULT '',
  verset_cle TEXT DEFAULT '',
  exhortation TEXT DEFAULT '',
  theme_style TEXT DEFAULT 'obsidian',
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(church_id, week_key)
);

-- Enable RLS
ALTER TABLE public.meditations_noe ENABLE ROW LEVEL SECURITY;

-- Policies (allow read/write for church collaboration)
DROP POLICY IF EXISTS "meditations_noe_select" ON public.meditations_noe;
CREATE POLICY "meditations_noe_select" ON public.meditations_noe
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "meditations_noe_insert" ON public.meditations_noe;
CREATE POLICY "meditations_noe_insert" ON public.meditations_noe
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "meditations_noe_update" ON public.meditations_noe;
CREATE POLICY "meditations_noe_update" ON public.meditations_noe
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "meditations_noe_delete" ON public.meditations_noe;
CREATE POLICY "meditations_noe_delete" ON public.meditations_noe
  FOR DELETE TO anon, authenticated USING (true);
