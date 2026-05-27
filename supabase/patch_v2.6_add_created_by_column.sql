-- 1. Ajouter la colonne created_by
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- 2. Migrer les anciennes données : initialiser created_by à assigned_to pour ne pas perdre les accès historiques
UPDATE public.invites SET created_by = assigned_to WHERE created_by IS NULL AND assigned_to IS NOT NULL;

-- 3. Mettre à jour la politique de lecture pour l'intégration (SELECT)
DROP POLICY IF EXISTS "invites_integration_read" ON public.invites;
CREATE POLICY "invites_integration_read" ON public.invites FOR SELECT TO authenticated
  USING (
    church_id = public.get_user_church()
    AND (
      public.get_user_role_from_profile() IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  );

-- 4. Mettre à jour la politique de gestion pour l'intégration (ALL / INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "invites_integration_manage" ON public.invites;
CREATE POLICY "invites_integration_manage" ON public.invites FOR ALL TO authenticated
  USING (
    church_id = public.get_user_church()
    AND (
      public.get_user_role_from_profile() IN ('integration_responsable', 'integration_second')
      OR assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  );

-- 5. Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';