-- Patch v7.6: objectifs et préparation du bilan mensuel d’Intégration
-- Les objectifs et notes sont partagés par les responsables d’une même église.
-- À exécuter dans le SQL Editor Supabase avant d’utiliser l’enregistrement du plan.

CREATE TABLE IF NOT EXISTS public.integration_monthly_report_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  report_period TEXT NOT NULL,
  monthly_guest_target INTEGER CHECK (monthly_guest_target IS NULL OR monthly_guest_target >= 0),
  observation TEXT NOT NULL DEFAULT '',
  challenge TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT '',
  due_date DATE,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT integration_monthly_report_plans_period_format
    CHECK (report_period ~ '^[0-9]{4}-(0[1-9]|1[0-2])(,(0[1-9]|1[0-2])){0,11}$'),
  CONSTRAINT integration_monthly_report_plans_unique_period
    UNIQUE (church_id, report_period)
);

COMMENT ON TABLE public.integration_monthly_report_plans IS
  'Objectifs d’accueil et notes de préparation du bilan mensuel du département Intégration.';
COMMENT ON COLUMN public.integration_monthly_report_plans.report_period IS
  'Année et mois sélectionnés sous la forme YYYY-MM,MM...';

CREATE INDEX IF NOT EXISTS idx_integration_report_plans_church
  ON public.integration_monthly_report_plans(church_id, report_period);

ALTER TABLE public.integration_monthly_report_plans ENABLE ROW LEVEL SECURITY;

-- Les accès passent par les actions serveur, qui vérifient le rôle et l’église
-- avant d’utiliser la clé de service. Aucun accès direct n’est accordé aux clients.
REVOKE ALL ON public.integration_monthly_report_plans FROM PUBLIC, anon, authenticated;

