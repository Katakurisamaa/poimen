-- Patch v7.8: département de service pour les invités devenus S.T.A.R.
-- À exécuter dans le SQL Editor Supabase avant d’enregistrer le département.

ALTER TABLE public.invites
  ADD COLUMN IF NOT EXISTS departement_star TEXT;

COMMENT ON COLUMN public.invites.departement_star IS
  'Département dans lequel l’invité devenu S.T.A.R. sert.';

NOTIFY pgrst, 'reload schema';
