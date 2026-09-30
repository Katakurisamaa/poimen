-- Patch v7.2: Ajout de la formation 12 Piliers (4 séances) et du pays de résidence
-- À exécuter dans le Supabase SQL Editor de votre projet

ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS piliers_1 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS piliers_2 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS piliers_3 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS piliers_4 BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS termine_12_piliers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS pays TEXT DEFAULT 'Belgique',
ADD COLUMN IF NOT EXISTS souhait_suivi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rdv_pastoral BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ne_decroche_pas BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS faux_numero BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS raison_echec TEXT DEFAULT '';

COMMENT ON COLUMN public.invites.piliers_1 IS 'Formation 12 Piliers - Séance 1';
COMMENT ON COLUMN public.invites.piliers_2 IS 'Formation 12 Piliers - Séance 2';
COMMENT ON COLUMN public.invites.piliers_3 IS 'Formation 12 Piliers - Séance 3';
COMMENT ON COLUMN public.invites.piliers_4 IS 'Formation 12 Piliers - Séance 4';
COMMENT ON COLUMN public.invites.termine_12_piliers IS 'Formation 12 Piliers terminée';
COMMENT ON COLUMN public.invites.pays IS 'Pays de résidence de l''invité';
COMMENT ON COLUMN public.invites.souhait_suivi IS 'Souhait de suivi spirituel / accompagnement après le call';
COMMENT ON COLUMN public.invites.rdv_pastoral IS 'Souhaite ou a pris un RDV pastoral';
COMMENT ON COLUMN public.invites.ne_decroche_pas IS 'Call tenté mais ne décroche pas / plusieurs relances';
COMMENT ON COLUMN public.invites.faux_numero IS 'Faux numéro ou numéro erroné';
COMMENT ON COLUMN public.invites.raison_echec IS 'Raison spécifique de l''échec de l''appel (ex: répondeur, faux numéro, etc.) distincte des commentaires de suivi pastoraux';
