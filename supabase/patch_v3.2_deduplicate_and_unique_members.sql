-- =============================================================
-- Poimén Patch v3.2 - Résolution Définitive des Doublons & RLS Recursion
-- =============================================================

-- 1. Nettoyage des doublons historiques de leaders (Dylan) dans la table members
-- Conserver uniquement la première occurrence créée pour chaque e-mail/bergerie
DELETE FROM public.members a USING public.members b
WHERE a.id > b.id 
  AND LOWER(a.email) = LOWER(b.email)
  AND a.bergerie_id = b.bergerie_id;

-- 2. Créer l'index unique indispensable pour empêcher toute future duplication
CREATE UNIQUE INDEX IF NOT EXISTS members_email_bergerie_idx ON public.members (email, bergerie_id);

-- 3. Redéfinir get_user_role avec priorité absolue à la table profiles (Session Auth)
-- Cela évite le bootstrap chicken-and-egg et toute récursion RLS sur la table members.
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- A. Lecture prioritaire depuis profiles (Source de vérité de l'utilisateur connecté)
  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;

  -- B. Repli historique sur members si non trouvé dans profiles
  IF v_role IS NULL THEN
    SELECT status INTO v_role
    FROM public.members 
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;
  
  RETURN LOWER(REPLACE(v_role, ' ', '_'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 4. Redéfinir get_user_bergerie avec priorité absolue à la table profiles
CREATE OR REPLACE FUNCTION public.get_user_bergerie()
RETURNS uuid AS $$
DECLARE
  v_bid uuid;
BEGIN
  -- A. Lecture prioritaire depuis profiles (Source de vérité de la bergerie connectée)
  SELECT bergerie_id INTO v_bid
  FROM public.profiles
  WHERE id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;

  -- B. Repli historique sur members si non trouvé dans profiles
  IF v_bid IS NULL THEN
    SELECT bergerie_id INTO v_bid
    FROM public.members 
    WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;
  
  RETURN v_bid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
