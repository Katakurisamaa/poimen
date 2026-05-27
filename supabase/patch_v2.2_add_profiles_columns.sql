-- Patch v2.2 : Ajout des colonnes de contact et profilage sur la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS civility TEXT;

-- Recharger le schéma PostgREST pour refléter immédiatement les nouvelles colonnes
NOTIFY pgrst, 'reload schema';
