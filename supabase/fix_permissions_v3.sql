-- SECURITY PATCH V3: Fixing RLS for Members-based Architecture (More Robust)

-- 1. Fix get_user_role to use members table with Case Insensitivity
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
DECLARE
  v_role text;
BEGIN
  -- We query members table by email from JWT (case-insensitive)
  SELECT status INTO v_role
  FROM public.members 
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Fix get_user_bergerie to use members table with Case Insensitivity
CREATE OR REPLACE FUNCTION public.get_user_bergerie()
RETURNS uuid AS $$
DECLARE
  v_bid uuid;
BEGIN
  SELECT bergerie_id INTO v_bid
  FROM public.members 
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
  LIMIT 1;
  
  RETURN v_bid;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Update invites policy to handle all role variants and deletion
DROP POLICY IF EXISTS "invites_access_policy" ON public.invites;
CREATE POLICY "invites_access_policy" ON public.invites
FOR ALL
TO authenticated
USING (
  -- Super admin / Project owner bypass
  (LOWER(auth.jwt() ->> 'email') = 'iccintegration2025@gmail.com')
  OR (LOWER(get_user_role()) = 'super_admin')
  -- Normal access: within the same bergerie and authorized role
  OR (
    bergerie_id = get_user_bergerie() 
    AND (
      LOWER(get_user_role()) ILIKE '%berger%' 
      OR LOWER(get_user_role()) ILIKE '%second%' 
      OR LOWER(get_user_role()) ILIKE '%responsable%'
      OR LOWER(get_user_role()) = 'admin'
    )
  )
  -- Or if they are the explicit responsible (using display_name from profiles as fallback)
  OR (responsible = (SELECT display_name FROM profiles WHERE id = auth.uid()))
)
WITH CHECK (
  (LOWER(auth.jwt() ->> 'email') = 'iccintegration2025@gmail.com')
  OR (LOWER(get_user_role()) = 'super_admin')
  OR (
    bergerie_id = get_user_bergerie() 
    AND (
      LOWER(get_user_role()) ILIKE '%berger%' 
      OR LOWER(get_user_role()) ILIKE '%second%' 
      OR LOWER(get_user_role()) ILIKE '%responsable%'
      OR LOWER(get_user_role()) = 'admin'
    )
  )
);

-- Force cache reload
NOTIFY pgrst, 'reload schema';
