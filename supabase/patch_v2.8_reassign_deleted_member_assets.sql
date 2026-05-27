-- Patch v2.8 : Reassign deleted member assets to superior (Berger or Integration Head)
-- Ce patch ajoute un trigger qui réaffecte automatiquement les invités (invites) et rapports d'évangélisation 
-- d'un membre supprimé à son supérieur direct (le Berger de sa famille ou le Responsable de l'Intégration).

CREATE OR REPLACE FUNCTION public.reassign_deleted_member_assets()
RETURNS TRIGGER AS $$
DECLARE
  v_profile_id UUID;
  v_profile_role TEXT;
  v_church_id UUID;
  v_bergerie_id UUID;
  v_superior_id UUID;
BEGIN
  -- 1. Récupérer le profil correspondant à l'adresse e-mail du membre supprimé
  SELECT id, role, church_id, bergerie_id
  INTO v_profile_id, v_profile_role, v_church_id, v_bergerie_id
  FROM public.profiles
  WHERE LOWER(email) = LOWER(OLD.email)
  LIMIT 1;

  -- S'il n'y a pas de profil utilisateur associé, il n'y a rien à réaffecter
  IF v_profile_id IS NULL THEN
    RETURN OLD;
  END IF;

  -- 2. Déterminer l'identifiant du supérieur direct
  IF v_profile_role LIKE 'integration_%' THEN
    -- Rôle d'intégration : le supérieur est le responsable de l'intégration ('integration_responsable')
    SELECT id INTO v_superior_id
    FROM public.profiles
    WHERE church_id = v_church_id
      AND role = 'integration_responsable'
    LIMIT 1;
    
    -- Repli sur un administrateur général de l'église si aucun responsable d'intégration n'est trouvé
    IF v_superior_id IS NULL THEN
      SELECT id INTO v_superior_id
      FROM public.profiles
      WHERE church_id = v_church_id
        AND role IN ('super_admin', 'admin')
      LIMIT 1;
    END IF;
  ELSE
    -- Rôle de famille : le supérieur est le Berger de la famille (bergerie)
    -- A. Chercher d'abord dans la table bergeries (le champ berger_id de la bergerie)
    SELECT b.berger_id INTO v_superior_id
    FROM public.bergeries b
    WHERE b.id = v_bergerie_id
    LIMIT 1;

    -- B. Repli sur tout profil ayant le rôle de 'berger' associé à cette famille
    IF v_superior_id IS NULL THEN
      SELECT id INTO v_superior_id
      FROM public.profiles
      WHERE bergerie_id = v_bergerie_id
        AND LOWER(role) LIKE '%berger%'
      LIMIT 1;
    END IF;

    -- C. Repli sur le responsable de l'intégration de la même église
    IF v_superior_id IS NULL THEN
      SELECT id INTO v_superior_id
      FROM public.profiles
      WHERE church_id = v_church_id
        AND role = 'integration_responsable'
      LIMIT 1;
    END IF;
  END IF;

  -- 3. Effectuer la réaffectation des éléments si un supérieur valide est trouvé
  IF v_superior_id IS NOT NULL AND v_superior_id <> v_profile_id THEN
    -- A. Réaffectation des invités (invites.assigned_to)
    UPDATE public.invites
    SET assigned_to = v_superior_id
    WHERE assigned_to = v_profile_id;

    -- B. Réaffectation des rapports d'évangélisation (evangelisations.created_by)
    UPDATE public.evangelisations
    SET created_by = v_superior_id
    WHERE created_by = v_profile_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Création du trigger sur la table members
DROP TRIGGER IF EXISTS tr_reassign_deleted_member_assets ON public.members;
CREATE TRIGGER tr_reassign_deleted_member_assets
BEFORE DELETE ON public.members
FOR EACH ROW
EXECUTE FUNCTION public.reassign_deleted_member_assets();
