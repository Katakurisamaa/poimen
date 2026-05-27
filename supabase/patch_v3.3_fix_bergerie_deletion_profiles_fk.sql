-- =============================================================
-- Poimén Patch v3.3 - Correction de la suppression des bergeries
-- =============================================================

-- Ce patch recrée proprement la contrainte de clé étrangère 'profiles_bergerie_id_fkey'
-- sur la table 'profiles' avec la clause 'ON DELETE SET NULL'. 
-- Cela évite l'erreur d'intégrité référentielle (code 23503) lors de la suppression
-- d'une Famille de disciples (bergerie) rattachée à des profils utilisateurs.

-- 1. RECRÉATION DE LA CONTRAINTE EN CASCADE (ON DELETE SET NULL)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bergerie_id_fkey,
  ADD CONSTRAINT profiles_bergerie_id_fkey 
    FOREIGN KEY (bergerie_id) 
    REFERENCES public.bergeries(id) 
    ON DELETE SET NULL;

-- 2. RECHARGE DU CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
