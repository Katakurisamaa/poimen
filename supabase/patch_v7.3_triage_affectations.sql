-- Patch v7.3: Système de triage et qualification des affectations (À affecter, Mes affectations, Conserver, Sans suite)
-- À exécuter dans le Supabase SQL Editor de votre projet

-- 1. Ajout des colonnes de gestion du pipeline de triage et call center
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS statut_affectation TEXT DEFAULT 'a_affecter',
ADD COLUMN IF NOT EXISTS motif_retrait TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS retire_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS retire_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS faux_numero BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ne_decroche_pas BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS souhait_suivi BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS rdv_pastoral BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS raison_echec TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS autre_eglise TEXT DEFAULT '';

-- 2. Index de base
CREATE INDEX IF NOT EXISTS idx_invites_statut_affectation ON public.invites(statut_affectation);
CREATE INDEX IF NOT EXISTS idx_invites_assigned_to ON public.invites(assigned_to);

-- 3. Documentation des colonnes
COMMENT ON COLUMN public.invites.statut_affectation IS 'Statut dans le pipeline de qualification: a_affecter (non assigné), en_attente_contact (assigné au conseiller mais appel non abouti), conserve (qualifié, suivi spirituel actif), sans_suite (retiré du suivi actif)';
COMMENT ON COLUMN public.invites.motif_retrait IS 'Motif de clôture du dossier (ex: faux_numero, autre_eglise, ne_decroche_pas, pas_interesse, demenagement, autre)';
COMMENT ON COLUMN public.invites.retire_par IS 'Identifiant auth.users de la personne ayant clôturé le dossier';
COMMENT ON COLUMN public.invites.retire_at IS 'Date et heure de la clôture du dossier';

-- 4. Réalignement automatique des données historiques :

-- Étape 4.1 : Détection et récupération des dossiers sans suite historiques
-- (Balisés dans commentaire_suivi, ou ayant un motif de retrait / raison d'échec)
UPDATE public.invites
SET 
  statut_affectation = 'sans_suite',
  motif_retrait = CASE 
    WHEN motif_retrait IS NOT NULL AND motif_retrait != '' THEN motif_retrait
    WHEN commentaire_suivi ~* '\[MOTIF_RETRAIT:\s*([^\]]+)\]' THEN substring(commentaire_suivi from '(?i)\[MOTIF_RETRAIT:\s*([^\]]+)\]')
    WHEN commentaire_suivi ~* '\[RAISON_ECHEC:\s*([^\]]+)\]' THEN substring(commentaire_suivi from '(?i)\[RAISON_ECHEC:\s*([^\]]+)\]')
    WHEN raison_echec IS NOT NULL AND raison_echec != '' THEN raison_echec
    WHEN faux_numero = true OR commentaire_suivi ~* '\[FAUX_NUMERO\]' THEN 'faux_numero'
    WHEN ne_decroche_pas = true OR commentaire_suivi ~* '\[NE_DECROCHE_PAS\]' THEN 'ne_decroche_pas'
    ELSE 'autre'
  END,
  retire_at = CASE
    WHEN retire_at IS NOT NULL THEN retire_at
    WHEN commentaire_suivi ~* '\[RETIRE_AT:\s*([^\]]+)\]' THEN (substring(commentaire_suivi from '(?i)\[RETIRE_AT:\s*([^\]]+)\]'))::timestamptz
    ELSE COALESCE(updated_at, created_at, NOW())
  END
WHERE 
  commentaire_suivi ~* '\[STATUT:\s*sans_suite\]'
  OR (motif_retrait IS NOT NULL AND motif_retrait != '')
  OR (raison_echec IS NOT NULL AND raison_echec != '' AND raison_echec NOT IN ('aucun', ''));

-- Étape 4.2 : Restauration de l'auteur du retrait (retire_par) si valide dans auth.users
UPDATE public.invites i
SET retire_par = u.id
FROM auth.users u
WHERE i.retire_par IS NULL
  AND i.commentaire_suivi ~* '\[RETIRE_PAR:\s*([a-f0-9\-]{36})\]'
  AND u.id = (substring(i.commentaire_suivi from '(?i)\[RETIRE_PAR:\s*([a-f0-9\-]{36})\]'))::uuid;

-- Étape 4.3 : Réalignement des âmes expressément conservées via balise
UPDATE public.invites
SET statut_affectation = 'conserve'
WHERE commentaire_suivi ~* '\[STATUT:\s*conserve\]'
  AND statut_affectation != 'sans_suite';

-- Étape 4.4 : Réalignement des âmes déjà assignées sans balise explicite :
-- Si appel_abouti = true -> 'conserve' (l'âme est entrée en suivi spirituel actif)
-- Sinon -> 'en_attente_contact' (assignée, contact en attente de réalisation)
UPDATE public.invites
SET statut_affectation = CASE
  WHEN appel_abouti = true THEN 'conserve'
  ELSE 'en_attente_contact'
END
WHERE (statut_affectation IS NULL OR statut_affectation = 'a_affecter')
  AND (assigned_to IS NOT NULL OR (responsible IS NOT NULL AND responsible != 'Non assigné' AND TRIM(responsible) != ''));

-- Étape 4.5 : Les âmes non attribuées et non clôturées sont confirmées à 'a_affecter'
UPDATE public.invites
SET statut_affectation = 'a_affecter'
WHERE (statut_affectation IS NULL OR statut_affectation = '')
  AND (assigned_to IS NULL AND (responsible IS NULL OR responsible = 'Non assigné' OR TRIM(responsible) = ''));

-- Étape 4.6 : Sécurité pour toute valeur NULL ou invalide restante
UPDATE public.invites
SET statut_affectation = 'a_affecter'
WHERE statut_affectation IS NULL OR statut_affectation NOT IN ('a_affecter', 'en_attente_contact', 'conserve', 'sans_suite');

-- 5. Contrainte de validation pour verrouiller les valeurs autorisées
ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS check_statut_affectation;
ALTER TABLE public.invites 
ADD CONSTRAINT check_statut_affectation 
CHECK (statut_affectation IN ('a_affecter', 'en_attente_contact', 'conserve', 'sans_suite'));

-- 6. Index composites de haute performance pour le filtrage du dashboard et des affectations
CREATE INDEX IF NOT EXISTS idx_invites_church_statut ON public.invites(church_id, statut_affectation);
CREATE INDEX IF NOT EXISTS idx_invites_assigned_statut ON public.invites(assigned_to, statut_affectation);
CREATE INDEX IF NOT EXISTS idx_invites_statut_appel ON public.invites(statut_affectation, appel_abouti);
CREATE INDEX IF NOT EXISTS idx_invites_motif_retrait ON public.invites(motif_retrait) WHERE statut_affectation = 'sans_suite';
