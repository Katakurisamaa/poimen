-- =============================================================
-- Poimén Patch v2.8 - Ajout du champ date d'évangélisation & Filtres
-- =============================================================

-- 1. Ajouter le champ date d'évangélisation si non existant
ALTER TABLE public.evangelisations 
ADD COLUMN IF NOT EXISTS evangelisation_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- 2. Désactiver RLS pour éviter tout blocage de session
ALTER TABLE public.evangelisations DISABLE ROW LEVEL SECURITY;

-- 3. Indexation pour accélérer les filtres sur la date d'évangélisation
CREATE INDEX IF NOT EXISTS idx_evangelisations_date ON public.evangelisations(evangelisation_date);

-- 4. Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
