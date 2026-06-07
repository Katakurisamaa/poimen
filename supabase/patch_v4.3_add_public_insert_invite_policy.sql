-- Allow anonymous/public users to insert new rows into invites table (for public registration link)
DROP POLICY IF EXISTS "invites_public_insert_policy" ON public.invites;
CREATE POLICY "invites_public_insert_policy" ON public.invites
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
