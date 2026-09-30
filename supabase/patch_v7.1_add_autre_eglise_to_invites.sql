-- Patch v7.1: Ajout du champ autre_eglise dans la table invites
-- Permet de spécifier le nom de l'église locale d'origine si l'invité persévère ailleurs

ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS autre_eglise TEXT;

COMMENT ON COLUMN public.invites.autre_eglise IS 'Nom de l''église locale d''origine si l''invité persévère déjà ailleurs';
