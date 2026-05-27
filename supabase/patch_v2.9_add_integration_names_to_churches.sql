-- Patch v2.9 - Ajout du Prénom et Nom du Responsable d'Intégration aux Églises
-- Ce patch ajoute les colonnes integration_first_name et integration_last_name à la table churches.

ALTER TABLE public.churches 
  ADD COLUMN IF NOT EXISTS integration_first_name TEXT,
  ADD COLUMN IF NOT EXISTS integration_last_name TEXT;

-- Recharger le cache PostgREST pour propager les nouveaux champs
NOTIFY pgrst, 'reload schema';
