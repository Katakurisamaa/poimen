-- Patch v4.2 : restaurer minkojunior400@gmail.com comme super admin de reference
-- sans retirer ses autres casquettes applicatives.

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    CASE WHEN LOWER(auth.jwt() ->> 'email') = 'minkojunior400@gmail.com' THEN 'super_admin' END,
    (
      SELECT LOWER(REPLACE(role, ' ', '_'))
      FROM public.profiles
      WHERE id = auth.uid()
    )
  )
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Recree la politique profiles principale avec le nouvel email de reference.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all" ON public.profiles;
CREATE POLICY "super_admin_all" ON public.profiles
FOR ALL
USING (
  LOWER(auth.jwt() ->> 'email') = 'minkojunior400@gmail.com'
  OR public.get_user_role() = 'super_admin'
  OR id = auth.uid()
)
WITH CHECK (
  LOWER(auth.jwt() ->> 'email') = 'minkojunior400@gmail.com'
  OR public.get_user_role() = 'super_admin'
  OR id = auth.uid()
);

-- S'assure que la casquette super admin existe, meme si le profil principal
-- reste une casquette famille comme "second du berger".
INSERT INTO public.user_contexts (user_id, email, context_type, role, display_name, active)
SELECT
  p.id,
  LOWER(TRIM(p.email)),
  'super_admin',
  'super_admin',
  COALESCE(p.display_name, 'Super Admin'),
  TRUE
FROM public.profiles p
WHERE LOWER(TRIM(p.email)) = 'minkojunior400@gmail.com'
ON CONFLICT DO NOTHING;
