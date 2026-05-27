-- =============================================================
-- Poimén Patch v3.4 - Correction de la synchronisation des noms complets (Multi-mots)
-- =============================================================

-- 1. CORRECTION DE LA FONCTION DU TRIGGER POUR PRENDRE LE NOM EN ENTIER (MÊME AVEC PLUSIEURS MOTS)
CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bergerie_id IS NOT NULL THEN
    INSERT INTO public.members (bergerie_id, civility, first_name, last_name, email, status)
    VALUES (
      NEW.bergerie_id,
      'M.',
      split_part(NEW.display_name, ' ', 1),
      COALESCE(substring(NEW.display_name from position(' ' in NEW.display_name) + 1), ''),
      NEW.email,
      CASE 
        WHEN NEW.role ILIKE '%berger%' THEN 'Berger'
        WHEN NEW.role ILIKE '%second%' THEN 'Second'
        WHEN NEW.role ILIKE '%responsable%' THEN 'Responsable'
        WHEN NEW.role ILIKE '%conseiller%' THEN 'Conseiller'
        ELSE 'Brebi'
      END,
      NEW.role ILIKE '%conseiller%'
    )
    ON CONFLICT (email, bergerie_id) DO UPDATE 
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        status = EXCLUDED.status,
        is_conseiller = EXCLUDED.is_conseiller;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. MISE À JOUR SYNCHRONE DES MEMBRES ACTUELS POUR CORRIGER LES NOMS TRONQUÉS (EX: DYLAN)
UPDATE public.members m
SET first_name = split_part(p.display_name, ' ', 1),
    last_name = COALESCE(substring(p.display_name from position(' ' in p.display_name) + 1), '')
FROM public.profiles p
WHERE LOWER(m.email) = LOWER(p.email);

-- 3. RECHARGE DU CACHE POSTGREST
NOTIFY pgrst, 'reload schema';
