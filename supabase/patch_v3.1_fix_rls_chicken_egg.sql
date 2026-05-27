-- =============================================================
-- Poimén Patch v3.1 - Correction RLS Bootstrap / Chicken-and-Egg
-- =============================================================

-- Cette migration corrige le problème où les fonctions de sécurité get_user_role() 
-- et get_user_bergerie() interrogent la table members alors que l'utilisateur 
-- connecté n'y est pas encore inséré (notamment lors du premier auto-ajout).

-- 1. Réécriture de la fonction get_user_role avec repli (fallback) sur la table profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- A. Essai d'extraction depuis la table members par email (insensible à la casse)
  SELECT status INTO v_role
  FROM public.members 
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;
  
  -- B. Si non trouvé dans members, repli sur le profil utilisateur
  IF v_role IS NULL THEN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;
  
  RETURN LOWER(REPLACE(v_role, ' ', '_'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Réécriture de la fonction get_user_bergerie avec repli (fallback) sur la table profiles
CREATE OR REPLACE FUNCTION public.get_user_bergerie()
RETURNS uuid AS $$
DECLARE
  v_bid uuid;
BEGIN
  -- A. Essai d'extraction depuis la table members par email (insensible à la casse)
  SELECT bergerie_id INTO v_bid
  FROM public.members 
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;
  
  -- B. Si non trouvé dans members, repli sur le profil utilisateur
  IF v_bid IS NULL THEN
    SELECT bergerie_id INTO v_bid
    FROM public.profiles
    WHERE id = auth.uid() OR LOWER(email) = LOWER(auth.jwt() ->> 'email')
    LIMIT 1;
  END IF;
  
  RETURN v_bid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Rechargement du cache de PostgREST
NOTIFY pgrst, 'reload schema';
