-- ==============================================================================
-- Poimén Patch v7.9 - Autorisation des Bergers et Seconds à modifier tout invité
-- (y compris les informations de suivi et la modification d'invités non assignés)
-- ==============================================================================
--
-- EXÉCUTER CE SCRIPT DANS LE SQL EDITOR DE VOTRE CONSOLE SUPABASE
--
-- Objectifs :
-- 1. Permettre aux Bergers, Seconds, Responsables, Admins et Super Admins de
--    modifier n'importe quel invité (date d'arrivée, coordonnées, suivi, etc.),
--    même si l'invité n'est pas encore assigné ou assigné à un autre conseiller.
-- 2. Conserver les restrictions de sécurité pour les simples conseillers
--    (qui ne peuvent modifier que les invités qui leur sont attribués).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_unassigned_invite_modification()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_is_special_role BOOLEAN := false;
BEGIN
  -- 0. Les services systèmes et requêtes serveur de confiance (service_role) ont les pleins pouvoirs
  IF current_user IN ('postgres', 'supabase_admin', 'service_role') OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. Vérification si l'utilisateur connecté est un leader (Berger, Second, Responsable, Admin, Super Admin)
  v_role := public.get_user_role_from_profile();
  
  IF v_role IN ('super_admin', 'admin', 'integration_responsable', 'integration_second', 'berger', 'second', 'second_du_berger', 'responsable', 'responsable_de_brebi', 'coordonnateur') THEN
    v_is_special_role := true;
  ELSE
    -- Vérification dans user_contexts si le rôle actif ou accordé est un rôle de leadership
    IF EXISTS (
      SELECT 1 FROM public.user_contexts
      WHERE user_id = auth.uid()
        AND active = true
        AND role IN ('super_admin', 'admin', 'integration_responsable', 'integration_second', 'berger', 'second', 'second_du_berger', 'responsable', 'responsable_de_brebi', 'coordonnateur')
    ) THEN
      v_is_special_role := true;
    END IF;
  END IF;

  -- LES LEADERS (Berger, Second, Responsable, etc.) ONT PLEIN POUVOIR DE MODIFICATION SUR TOUS LES INVITÉS
  IF v_is_special_role THEN
    RETURN NEW;
  END IF;

  -- RÈGLES STRICTES POUR LES CONSEILLERS STANDARDS :
  IF OLD.church_id IS NOT NULL AND OLD.bergerie_id IS NULL THEN
    
    -- A. Sécurisation des informations de suivi pour les conseillers normaux
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
      IF OLD.assigned_to IS NULL THEN
        RAISE EXCEPTION 'Les informations de suivi (participation CDM, culte, formations, etc.) ne peuvent pas être renseignées ou modifiées tant que l''invité n''est pas assigné à un conseiller.';
      ELSIF OLD.assigned_to IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Seul le conseiller à qui l''invité est assigné a le droit de modifier ses informations de suivi.';
      END IF;
    END IF;

    -- B. Sécurisation des données de base d'un invité non assigné pour les conseillers normaux
    IF OLD.assigned_to IS NULL THEN
      IF NEW.assigned_to IS NULL THEN
        RAISE EXCEPTION 'Vous devez d''abord vous assigner cet invité ou demander à un responsable de vous l''assigner avant de modifier ses informations.';
      ELSE
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- S'assurer que le trigger est bien attaché
DROP TRIGGER IF EXISTS tr_check_unassigned_invite_modification ON public.invites;
CREATE TRIGGER tr_check_unassigned_invite_modification
  BEFORE UPDATE ON public.invites
  FOR EACH ROW EXECUTE FUNCTION public.check_unassigned_invite_modification();

-- Rechargement du cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';
