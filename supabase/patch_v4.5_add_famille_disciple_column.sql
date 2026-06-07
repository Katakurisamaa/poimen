-- =============================================================
-- Poimén Patch v4.5 - Add Family Selector Column to Invites
-- =============================================================

-- Add famille_disciple column to invites table with default value 'AUCUNE'
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS famille_disciple TEXT DEFAULT 'AUCUNE';

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
