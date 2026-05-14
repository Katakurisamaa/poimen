-- =============================================================
-- Poimén Patch v1.5 - Sync Leader to Members
-- =============================================================

-- 1. Permettre aux champs non renseignés d'être vides dans la table members
ALTER TABLE public.members ALTER COLUMN age DROP NOT NULL;

-- 2. Mettre à jour la fonction de synchronisation pour être plus robuste
CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS TRIGGER AS $$
BEGIN
  -- On ne synchronise que si une bergerie est assignée au profil
  IF NEW.bergerie_id IS NOT NULL THEN
    INSERT INTO public.members (
      bergerie_id, 
      civility, 
      first_name, 
      last_name, 
      email, 
      status
    )
    VALUES (
      NEW.bergerie_id,
      'M.', -- Valeur par défaut, pourra être éditée
      split_part(NEW.display_name, ' ', 1),
      COALESCE(split_part(NEW.display_name, ' ', 2), ''),
      NEW.email,
      CASE 
        WHEN NEW.role ILIKE '%berger%' THEN 'Berger'
        WHEN NEW.role ILIKE '%second%' THEN 'Second'
        WHEN NEW.role ILIKE '%responsable%' THEN 'Responsable'
        ELSE 'Brebi'
      END
    )
    ON CONFLICT (email, bergerie_id) DO UPDATE 
    SET status = EXCLUDED.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REFRESH
NOTIFY pgrst, 'reload schema';
