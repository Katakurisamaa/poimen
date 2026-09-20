-- Migration: Add planning_integration table for Integration monthly schedule
CREATE TABLE IF NOT EXISTS public.planning_integration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  month_key TEXT NOT NULL, -- e.g. "2026-09"
  weeks JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_dates JSONB NOT NULL DEFAULT '{}'::jsonb,
  guidelines JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(church_id, month_key)
);

-- Enable RLS
ALTER TABLE public.planning_integration ENABLE ROW LEVEL SECURITY;

-- Policies (consistent with other church reporting and collaboration tables)
DROP POLICY IF EXISTS "planning_integration_select" ON public.planning_integration;
CREATE POLICY "planning_integration_select" ON public.planning_integration
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "planning_integration_insert" ON public.planning_integration;
CREATE POLICY "planning_integration_insert" ON public.planning_integration
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "planning_integration_update" ON public.planning_integration;
CREATE POLICY "planning_integration_update" ON public.planning_integration
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "planning_integration_delete" ON public.planning_integration;
CREATE POLICY "planning_integration_delete" ON public.planning_integration
  FOR DELETE TO anon, authenticated USING (true);
