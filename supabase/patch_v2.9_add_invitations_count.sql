-- =============================================================
-- Poimén Patch v2.9b - Ajout du nombre de cartons d'invitation
-- =============================================================

ALTER TABLE public.evangelisations ADD COLUMN IF NOT EXISTS invitations_count INT NOT NULL DEFAULT 0;

-- Recharger le cache du schéma PostgREST pour propager les colonnes immédiatement
NOTIFY pgrst, 'reload schema';
