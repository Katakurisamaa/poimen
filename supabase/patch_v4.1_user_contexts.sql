-- Patch v4.1 : Casquettes utilisateur
-- Permet a une meme adresse e-mail d'avoir plusieurs espaces
-- (super admin, integration, famille de disciples) sans ecraser le profil principal.

CREATE TABLE IF NOT EXISTS public.user_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  context_type TEXT NOT NULL CHECK (context_type IN ('super_admin', 'family', 'integration')),
  role TEXT NOT NULL,
  church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  bergerie_id UUID REFERENCES public.bergeries(id) ON DELETE SET NULL,
  display_name TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_contexts_unique_context
ON public.user_contexts (
  user_id,
  context_type,
  role,
  COALESCE(church_id, '00000000-0000-0000-0000-000000000000'::uuid),
  COALESCE(bergerie_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS user_contexts_user_id_idx ON public.user_contexts(user_id);
CREATE INDEX IF NOT EXISTS user_contexts_email_idx ON public.user_contexts(LOWER(email));
CREATE INDEX IF NOT EXISTS user_contexts_church_id_idx ON public.user_contexts(church_id);
CREATE INDEX IF NOT EXISTS user_contexts_bergerie_id_idx ON public.user_contexts(bergerie_id);

ALTER TABLE public.user_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_contexts_read_own" ON public.user_contexts;
CREATE POLICY "user_contexts_read_own"
ON public.user_contexts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_contexts_update_own_active_state" ON public.user_contexts;
CREATE POLICY "user_contexts_update_own_active_state"
ON public.user_contexts FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_user_contexts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_user_contexts_updated_at ON public.user_contexts;
CREATE TRIGGER tr_touch_user_contexts_updated_at
BEFORE UPDATE ON public.user_contexts
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_contexts_updated_at();

-- Backfill depuis les profils existants.
INSERT INTO public.user_contexts (user_id, email, context_type, role, church_id, bergerie_id, display_name)
SELECT
  p.id,
  LOWER(TRIM(p.email)),
  CASE
    WHEN LOWER(TRIM(p.role)) = 'super_admin' THEN 'super_admin'
    WHEN LOWER(TRIM(p.role)) LIKE 'integration_%' THEN 'integration'
    ELSE 'family'
  END,
  LOWER(TRIM(p.role)),
  p.church_id,
  p.bergerie_id,
  p.display_name
FROM public.profiles p
WHERE p.email IS NOT NULL
  AND p.role IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill des casquettes famille pour les comptes auth deja existants par email.
INSERT INTO public.user_contexts (user_id, email, context_type, role, church_id, bergerie_id, display_name)
SELECT
  p.id,
  LOWER(TRIM(p.email)),
  'family',
  CASE
    WHEN LOWER(TRIM(m.status)) IN ('responsable', 'responsable de brebis') THEN 'responsable de brebi'
    WHEN LOWER(TRIM(m.status)) IN ('second', 'second du berger') THEN 'second du berger'
    ELSE COALESCE(LOWER(TRIM(m.status)), 'membre')
  END,
  b.church_id,
  m.bergerie_id,
  TRIM(CONCAT(COALESCE(m.first_name, ''), ' ', COALESCE(m.last_name, '')))
FROM public.profiles p
JOIN public.members m ON LOWER(TRIM(m.email)) = LOWER(TRIM(p.email))
JOIN public.bergeries b ON b.id = m.bergerie_id
WHERE p.email IS NOT NULL
ON CONFLICT DO NOTHING;

-- Backfill de la casquette responsable integration pour les comptes auth deja existants par email.
INSERT INTO public.user_contexts (user_id, email, context_type, role, church_id, display_name)
SELECT
  p.id,
  LOWER(TRIM(p.email)),
  'integration',
  'integration_responsable',
  c.id,
  COALESCE(
    NULLIF(TRIM(CONCAT(COALESCE(c.integration_first_name, ''), ' ', COALESCE(c.integration_last_name, ''))), ''),
    'Responsable Integration'
  )
FROM public.profiles p
JOIN public.churches c ON LOWER(TRIM(c.integration_email)) = LOWER(TRIM(p.email))
WHERE p.email IS NOT NULL
ON CONFLICT DO NOTHING;

-- Securite : l'adresse super admin historique reste minkojunior400@gmail.com.
INSERT INTO public.user_contexts (user_id, email, context_type, role, display_name)
SELECT
  p.id,
  LOWER(TRIM(p.email)),
  'super_admin',
  'super_admin',
  COALESCE(p.display_name, 'Super Admin')
FROM public.profiles p
WHERE LOWER(TRIM(p.email)) = 'minkojunior400@gmail.com'
ON CONFLICT DO NOTHING;
