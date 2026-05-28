-- =============================================================
-- Poimén Patch v3.6 - Fix Unique Constraint on Members (Bunker Mode)
-- =============================================================

-- 1. DROP THE OLD UNIQUE INDEX
DROP INDEX IF EXISTS public.members_email_bergerie_idx;

-- 2. CREATE THE NEW PARTIAL UNIQUE INDEX (ALLOWS MULTIPLE NULL/EMPTY EMAILS AND ARCHIVED MEMBERS)
CREATE UNIQUE INDEX IF NOT EXISTS members_email_bergerie_idx 
ON public.members (email, bergerie_id) 
WHERE (email IS NOT NULL AND email <> '' AND archived = false);

-- 3. REDEFINE THE SYNC PROFILE TRIGGER TO USE THE PARTIAL UNIQUE INDEX ON CONFLICT
CREATE OR REPLACE FUNCTION public.sync_profile_to_member()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.bergerie_id IS NOT NULL THEN
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
    ON CONFLICT (email, bergerie_id) WHERE (email IS NOT NULL AND email <> '' AND archived = false) 
    DO UPDATE SET 
      status = EXCLUDED.status,
      is_conseiller = EXCLUDED.is_conseiller;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. REFRESH SCHEMA FOR POSTGREST
NOTIFY pgrst, 'reload schema';
