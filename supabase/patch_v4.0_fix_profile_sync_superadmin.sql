-- =============================================================
-- Poimén Patch v4.0 - Fix Profile Sync for Super Admin
-- =============================================================

CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS TRIGGER AS $$
BEGIN
  -- Exclure le rôle 'super_admin' pour éviter d'insérer l'admin central en tant que brebi/leader
  IF NEW.bergerie_id IS NOT NULL AND NEW.role <> 'super_admin' THEN
    INSERT INTO public.members (bergerie_id, civility, first_name, last_name, email, status)
    VALUES (
      NEW.bergerie_id,
      'M.',
      split_part(NEW.display_name, ' ', 1),
      COALESCE(split_part(NEW.display_name, ' ', 2), ''),
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
    ON CONFLICT (email, bergerie_id) WHERE (email IS NOT NULL AND email <> '' AND archived = false) DO UPDATE 
    SET status = EXCLUDED.status,
        is_conseiller = EXCLUDED.is_conseiller;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recharger le cache PostgREST
NOTIFY pgrst, 'reload schema';
