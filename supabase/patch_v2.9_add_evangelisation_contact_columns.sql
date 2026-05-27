-- =============================================================
-- Poimén Patch v2.9 - Suivi des appels post-évangélisation
-- =============================================================

ALTER TABLE public.evangelisations ADD COLUMN IF NOT EXISTS is_contacted BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.evangelisations ADD COLUMN IF NOT EXISTS call_comment TEXT;

-- Recharger le cache du schéma PostgREST pour propager les colonnes
NOTIFY pgrst, 'reload schema';
