-- =============================================================
-- Poimén Patch v3.0 - Verrouillage strict des informations de suivi des invités
-- =============================================================

-- 1. REWRITE THE TRIGGER FUNCTION FOR INVITE UPDATE
CREATE OR REPLACE FUNCTION public.check_unassigned_invite_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_is_special_role BOOLEAN;
BEGIN
  -- Cette règle s'applique spécifiquement aux invités de l'intégration
  -- (ceux qui ont un church_id mais pas de bergerie_id)
  IF OLD.church_id IS NOT NULL AND OLD.bergerie_id IS NULL THEN
    
    -- 1. SECURISATION DES INFORMATIONS DE SUIVI
    IF (OLD.appel_abouti IS DISTINCT FROM NEW.appel_abouti) OR
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
       (OLD.devenu_star IS DISTINCT FROM NEW.devenu_star) OR
       (OLD.interet_cdm IS DISTINCT FROM NEW.interet_cdm) OR
       (OLD.integre_cdm IS DISTINCT FROM NEW.integre_cdm) OR
       (OLD.priere_partage IS DISTINCT FROM NEW.priere_partage) OR
       (OLD.dans_famille_disciple IS DISTINCT FROM NEW.dans_famille_disciple) OR
       (OLD.interet_bapteme IS DISTINCT FROM NEW.interet_bapteme) OR
       (OLD.commentaire_suivi IS DISTINCT FROM NEW.commentaire_suivi) OR
       (OLD.attendance IS DISTINCT FROM NEW.attendance)
    THEN
      -- Cas A : L'invité n'est pas assigné du tout
      IF OLD.assigned_to IS NULL THEN
        RAISE EXCEPTION 'Les informations de suivi (participation CDM, culte, formations, etc.) ne peuvent pas être modifiées tant que l''invité n''est pas assigné.';
      -- Cas B : L'invité est assigné à quelqu'un d'autre que l'utilisateur connecté
      ELSIF OLD.assigned_to IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Seul le conseiller à qui l''invité est assigné a le droit de modifier ses informations de suivi.';
      END IF;
    END IF;

    -- 2. SECURISATION DES INFORMATIONS DE BASE POUR LES INVITES NON ASSIGNES
    IF OLD.assigned_to IS NULL THEN
      v_role := public.get_user_role_from_profile();
      v_is_special_role := v_role IN ('super_admin', 'integration_responsable', 'integration_second');

      IF NOT v_is_special_role THEN
        -- Rôle normal (conseiller) :
        -- A. Si l'invité reste non assigné (NEW.assigned_to IS NULL)
        IF NEW.assigned_to IS NULL THEN
          RAISE EXCEPTION 'Vous devez d''abord vous assigner cet invité ou demander à un responsable de vous l''assigner avant de modifier ses informations.';
        -- B. Si l'on assigne le conseiller (NEW.assigned_to IS NOT NULL)
        ELSE
          -- Le conseiller normal n'a le droit de modifier QUE les champs d'assignation (assigned_to, responsible)
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
             (OLD.is_in_bergerie IS DISTINCT FROM NEW.is_in_bergerie) OR
             (OLD.status IS DISTINCT FROM NEW.status) OR
             (OLD.commentaire IS DISTINCT FROM NEW.commentaire) OR
             (OLD.archived IS DISTINCT FROM NEW.archived) OR
             (OLD.sms_bienvenue IS DISTINCT FROM NEW.sms_bienvenue) OR
             (OLD.priere IS DISTINCT FROM NEW.priere) OR
             (OLD.interet_evenement IS DISTINCT FROM NEW.interet_evenement) OR
             (OLD.interet_formation IS DISTINCT FROM NEW.interet_formation) OR
             (OLD.a_ete_invite IS DISTINCT FROM NEW.a_ete_invite) OR
             (OLD.par_qui IS DISTINCT FROM NEW.par_qui)
          THEN
            RAISE EXCEPTION 'Vous devez d''abord être assigné à cet invité pour pouvoir modifier ses données personnelles.';
          END IF;
        END IF;
      END IF;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. RE-ASSOCIATE TRIGGER TO INVITES TABLE
DROP TRIGGER IF EXISTS tr_check_unassigned_invite_modification ON public.invites;
CREATE TRIGGER tr_check_unassigned_invite_modification
  BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.check_unassigned_invite_modification();

-- 3. RELOAD SCHEMAS TO AVOID SCHEMA CACHE DELAY
NOTIFY pgrst, 'reload schema';
