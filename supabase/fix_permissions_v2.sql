-- SECURITY PATCH V2: Fixing RLS for Members-based Architecture

-- 1. Fix get_user_role to use members table
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text AS $$
BEGIN
  -- We query members table by email from JWT
  -- This is more reliable as profiles might be empty
  RETURN (
    SELECT status 
    FROM public.members 
    WHERE email = (auth.jwt() ->> 'email')
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. Fix get_user_bergerie to use members table
CREATE OR REPLACE FUNCTION public.get_user_bergerie()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT bergerie_id 
    FROM public.members 
    WHERE email = (auth.jwt() ->> 'email')
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Update invites policy to handle all role variants and deletion
DROP POLICY IF EXISTS "invites_access_policy" ON public.invites;
CREATE POLICY "invites_access_policy" ON public.invites
FOR ALL
TO authenticated
USING (
  -- Super admin / Project owner bypass
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com')
  OR (get_user_role() = 'super_admin')
  -- Regional coordinators or higher roles
  OR (get_user_role() = 'Admin')
  -- Normal access: within the same bergerie and authorized role
  OR (
    bergerie_id = get_user_bergerie() 
    AND (
      get_user_role() IN ('Berger', 'Second', 'Responsable', 'berger', 'second_du_berger', 'responsable_de_brebi')
    )
  )
)
WITH CHECK (
  (auth.jwt() ->> 'email' = 'minkojunior400@gmail.com')
  OR (get_user_role() = 'super_admin')
  OR (get_user_role() = 'Admin')
  OR (
    bergerie_id = get_user_bergerie() 
    AND (
      get_user_role() IN ('Berger', 'Second', 'Responsable', 'berger', 'second_du_berger', 'responsable_de_brebi')
    )
  )
);

-- Force cache reload
NOTIFY pgrst, 'reload schema';
