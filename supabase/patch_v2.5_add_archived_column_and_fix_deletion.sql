-- =============================================================
-- Poimén Patch v2.5 - Ajout de la colonne archived et correction de la suppression des invités d'intégration
-- =============================================================

-- 1. Ajout de la colonne 'archived' à la table 'invites' si elle n'existe pas
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT false;

-- 2. Initialisation des enregistrements existants à 'false' pour éviter tout comportement inattendu
UPDATE public.invites SET archived = false WHERE archived IS NULL;

-- 3. Recréation de la fonction check_unassigned_invite_modification() pour s'assurer de sa bonne compilation et de son fonctionnement
CREATE OR REPLACE FUNCTION public.check_unassigned_invite_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
BEGIN
  -- Cette règle s'applique spécifiquement aux invités de l'intégration
  -- (ceux qui ont un church_id mais pas de bergerie_id)
  IF OLD.church_id IS NOT NULL AND OLD.bergerie_id IS NULL THEN
    -- Si l'invité était non assigné (OLD.assigned_to IS NULL)
    IF OLD.assigned_to IS NULL THEN
      -- A. Si l'on assigne le conseiller (NEW.assigned_to IS NOT NULL), l'opération est autorisée.
      -- On vérifie cependant qu'aucun autre champ de données n'est modifié à cette occasion.
      IF NEW.assigned_to IS NOT NULL THEN
        IF (OLD.first_name IS DISTINCT FROM NEW.first_name) OR
           (OLD.last_name IS DISTINCT FROM NEW.last_name) OR
           (OLD.civility IS DISTINCT FROM NEW.civility) OR
           (OLD.age IS DISTINCT FROM NEW.age) OR
           (OLD.phone IS DISTINCT FROM NEW.phone) OR
           (OLD.email IS DISTINCT FROM NEW.email) OR
           (OLD.address IS DISTINCT FROM NEW.address) OR
           (OLD.arrival_date IS DISTINCT FROM NEW.arrival_date) OR
           (OLD.event IS DISTINCT FROM NEW.event) OR
           (OLD.aps IS DISTINCT FROM NEW.aps) OR
           (OLD.local_church IS DISTINCT FROM NEW.local_church) OR
           (OLD.responsible IS DISTINCT FROM NEW.responsible) OR
           (OLD.is_in_bergerie IS DISTINCT FROM NEW.is_in_bergerie) OR
           (OLD.status IS DISTINCT FROM NEW.status) OR
           (OLD.attendance IS DISTINCT FROM NEW.attendance) OR
           (OLD.commentaire IS DISTINCT FROM NEW.commentaire) OR
           (OLD.archived IS DISTINCT FROM NEW.archived) OR
           (OLD.sms_bienvenue IS DISTINCT FROM NEW.sms_bienvenue) OR
           (OLD.priere IS DISTINCT FROM NEW.priere) OR
           (OLD.interet_evenement IS DISTINCT FROM NEW.interet_evenement) OR
           (OLD.interet_formation IS DISTINCT FROM NEW.interet_formation) OR
           (OLD.a_ete_invite IS DISTINCT FROM NEW.a_ete_invite) OR
           (OLD.par_qui IS DISTINCT FROM NEW.par_qui) OR
           (OLD.interet_cdm IS DISTINCT FROM NEW.interet_cdm) OR
           (OLD.integre_cdm IS DISTINCT FROM NEW.integre_cdm) OR
           (OLD.priere_partage IS DISTINCT FROM NEW.priere_partage) OR
           (OLD.dans_famille_disciple IS DISTINCT FROM NEW.dans_famille_disciple) OR
           (OLD.interet_bapteme IS DISTINCT FROM NEW.interet_bapteme) OR
           (OLD.commentaire_suivi IS DISTINCT FROM NEW.commentaire_suivi) OR
           (OLD.appel_abouti IS DISTINCT FROM NEW.appel_abouti) OR
           (OLD.groupe_whatsapp IS DISTINCT FROM NEW.groupe_whatsapp) OR
           (OLD.prevu_revenir IS DISTINCT FROM NEW.prevu_revenir) OR
           (OLD.est_revenu_culte IS DISTINCT FROM NEW.est_revenu_culte) OR
           (OLD.rencontre_effectuee IS DISTINCT FROM NEW.rencontre_effectuee) OR
           (OLD.visite_domicile IS DISTINCT FROM NEW.visite_domicile) OR
           (OLD.cocktail_bienvenue IS DISTINCT FROM NEW.cocktail_bienvenue) OR
           (OLD.pcnc IS DISTINCT FROM NEW.pcnc) OR
           (OLD.p101 IS DISTINCT FROM NEW.p101) OR
           (OLD.p201 IS DISTINCT FROM NEW.p201) OR
           (OLD.p301 IS DISTINCT FROM NEW.p301) OR
           (OLD.termine_pcnc IS DISTINCT FROM NEW.termine_pcnc) OR
           (OLD.bapteme_eau IS DISTINCT FROM NEW.bapteme_eau) OR
           (OLD.bapteme_esprit IS DISTINCT FROM NEW.bapteme_esprit) OR
           (OLD.veut_servir IS DISTINCT FROM NEW.veut_servir) OR
           (OLD.devenu_star IS DISTINCT FROM NEW.devenu_star)
        THEN
          RAISE EXCEPTION 'Vous devez d''abord assigner l''invité à un conseiller avant de pouvoir modifier ses données.';
        END IF;
      
      -- B. L'invité reste non assigné (NEW.assigned_to IS NULL).
      -- Les responsables et seconds du département d'intégration ont toutefois le droit d'archiver ou de restaurer l'invité.
      ELSE
        v_role := public.get_user_role_from_profile();
        IF v_role IN ('super_admin', 'integration_responsable', 'integration_second') AND (OLD.archived IS DISTINCT FROM NEW.archived) THEN
          -- On vérifie que seul le champ 'archived' a été modifié
          IF (OLD.first_name IS DISTINCT FROM NEW.first_name) OR
             (OLD.last_name IS DISTINCT FROM NEW.last_name) OR
             (OLD.civility IS DISTINCT FROM NEW.civility) OR
             (OLD.age IS DISTINCT FROM NEW.age) OR
             (OLD.phone IS DISTINCT FROM NEW.phone) OR
             (OLD.email IS DISTINCT FROM NEW.email) OR
             (OLD.address IS DISTINCT FROM NEW.address) OR
             (OLD.arrival_date IS DISTINCT FROM NEW.arrival_date) OR
             (OLD.event IS DISTINCT FROM NEW.event) OR
             (OLD.aps IS DISTINCT FROM NEW.aps) OR
             (OLD.local_church IS DISTINCT FROM NEW.local_church) OR
             (OLD.responsible IS DISTINCT FROM NEW.responsible) OR
             (OLD.is_in_bergerie IS DISTINCT FROM NEW.is_in_bergerie) OR
             (OLD.status IS DISTINCT FROM NEW.status) OR
             (OLD.attendance IS DISTINCT FROM NEW.attendance) OR
             (OLD.commentaire IS DISTINCT FROM NEW.commentaire) OR
             (OLD.sms_bienvenue IS DISTINCT FROM NEW.sms_bienvenue) OR
             (OLD.priere IS DISTINCT FROM NEW.priere) OR
             (OLD.interet_evenement IS DISTINCT FROM NEW.interet_evenement) OR
             (OLD.interet_formation IS DISTINCT FROM NEW.interet_formation) OR
             (OLD.a_ete_invite IS DISTINCT FROM NEW.a_ete_invite) OR
             (OLD.par_qui IS DISTINCT FROM NEW.par_qui) OR
             (OLD.interet_cdm IS DISTINCT FROM NEW.interet_cdm) OR
             (OLD.integre_cdm IS DISTINCT FROM NEW.integre_cdm) OR
             (OLD.priere_partage IS DISTINCT FROM NEW.priere_partage) OR
             (OLD.dans_famille_disciple IS DISTINCT FROM NEW.dans_famille_disciple) OR
             (OLD.interet_bapteme IS DISTINCT FROM NEW.interet_bapteme) OR
             (OLD.commentaire_suivi IS DISTINCT FROM NEW.commentaire_suivi) OR
             (OLD.appel_abouti IS DISTINCT FROM NEW.appel_abouti) OR
             (OLD.groupe_whatsapp IS DISTINCT FROM NEW.groupe_whatsapp) OR
             (OLD.prevu_revenir IS DISTINCT FROM NEW.prevu_revenir) OR
             (OLD.est_revenu_culte IS DISTINCT FROM NEW.est_revenu_culte) OR
             (OLD.rencontre_effectuee IS DISTINCT FROM NEW.rencontre_effectuee) OR
             (OLD.visite_domicile IS DISTINCT FROM NEW.visite_domicile) OR
             (OLD.cocktail_bienvenue IS DISTINCT FROM NEW.cocktail_bienvenue) OR
             (OLD.pcnc IS DISTINCT FROM NEW.pcnc) OR
             (OLD.p101 IS DISTINCT FROM NEW.p101) OR
             (OLD.p201 IS DISTINCT FROM NEW.p201) OR
             (OLD.p301 IS DISTINCT FROM NEW.p301) OR
             (OLD.termine_pcnc IS DISTINCT FROM NEW.termine_pcnc) OR
             (OLD.bapteme_eau IS DISTINCT FROM NEW.bapteme_eau) OR
             (OLD.bapteme_esprit IS DISTINCT FROM NEW.bapteme_esprit) OR
             (OLD.veut_servir IS DISTINCT FROM NEW.veut_servir) OR
             (OLD.devenu_star IS DISTINCT FROM NEW.devenu_star)
          THEN
            RAISE EXCEPTION 'Les responsables peuvent uniquement archiver/restaurer un invité non assigné, pas modifier ses données.';
          END IF;
        ELSE
          RAISE EXCEPTION 'Les données d''un invité non assigné ne peuvent pas être modifiées.';
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. RECHARGEMENT DU CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
