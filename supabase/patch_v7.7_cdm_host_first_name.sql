-- Patch v7.7: prénom de l’hôte pour les invités intégrés en C.D.M.
-- À exécuter dans le SQL Editor Supabase avant d’enregistrer cette information.

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS prenom_hote_cdm TEXT;

COMMENT ON COLUMN public.invites.prenom_hote_cdm IS
  'Prénom de l’hôte de la cellule de maison ayant accueilli l’invité.';
