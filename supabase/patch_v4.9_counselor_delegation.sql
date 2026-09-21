-- Patch v4.9: Délégation d'affectation des invités aux conseillers
-- Permet au responsable ou second d'accorder à un conseiller le droit de voir tous les invités
-- et de les affecter, tout en interdisant la modification des fiches non encodées par lui-même.

DROP POLICY IF EXISTS "invites_integration_read_policy" ON public.invites;
CREATE POLICY "invites_integration_read_policy" ON public.invites FOR SELECT TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND (church_id = public.get_user_church() OR bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church()))) OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid()) OR
  (bergerie_id = get_user_bergerie()) OR
  EXISTS (
    SELECT 1 FROM public.user_contexts uc 
    WHERE uc.user_id = auth.uid() 
      AND uc.context_type = 'integration' 
      AND uc.active = true 
      AND (uc.metadata->>'can_dispatch_all')::boolean = true 
      AND (uc.church_id = invites.church_id OR invites.church_id IS NULL)
  )
);

DROP POLICY IF EXISTS "invites_integration_manage_policy" ON public.invites;
CREATE POLICY "invites_integration_manage_policy" ON public.invites FOR ALL TO authenticated
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin') OR 
  (get_user_role() IN ('integration_responsable', 'integration_second') AND (church_id = public.get_user_church() OR bergerie_id IN (SELECT id FROM public.bergeries WHERE church_id = public.get_user_church()))) OR
  (assigned_to = auth.uid()) OR
  (created_by = auth.uid()) OR
  (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','second','coordonnateur','second_du_berger','responsable_de_brebi','conseiller')) OR
  EXISTS (
    SELECT 1 FROM public.user_contexts uc 
    WHERE uc.user_id = auth.uid() 
      AND uc.context_type = 'integration' 
      AND uc.active = true 
      AND (uc.metadata->>'can_dispatch_all')::boolean = true 
      AND (uc.church_id = invites.church_id OR invites.church_id IS NULL)
  )
);

NOTIFY pgrst, 'reload schema';
