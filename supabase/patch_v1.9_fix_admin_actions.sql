-- =============================================================
-- Poimén Patch v1.9 - Fix Admin Deletions & Cascade constraints
-- =============================================================

-- 1. DROITS DE SUPPRESSION ET MISE À JOUR POUR LE RÔLE ANON
-- RLS est déjà activé. Nous ajoutons les politiques pour permettre les actions de la Console d'Administration.

-- Églises
DROP POLICY IF EXISTS "Allow anonymous delete on churches" ON public.churches;
CREATE POLICY "Allow anonymous delete on churches" 
ON public.churches FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous update on churches" ON public.churches;
CREATE POLICY "Allow anonymous update on churches" 
ON public.churches FOR UPDATE TO anon USING (true);

-- Bergeries (Familles)
DROP POLICY IF EXISTS "Allow anonymous delete on bergeries" ON public.bergeries;
CREATE POLICY "Allow anonymous delete on bergeries" 
ON public.bergeries FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous update on bergeries" ON public.bergeries;
CREATE POLICY "Allow anonymous update on bergeries" 
ON public.bergeries FOR UPDATE TO anon USING (true);


-- 2. GARANTIE DU COMPORTEMENT EN CASCADE (ON DELETE CASCADE)
-- Nous recréons proprement les contraintes pour s'assurer que tout soit supprimé proprement si une église est retirée.

-- De bergeries vers churches
ALTER TABLE public.bergeries 
  DROP CONSTRAINT IF EXISTS bergeries_church_id_fkey,
  ADD CONSTRAINT bergeries_church_id_fkey 
    FOREIGN KEY (church_id) 
    REFERENCES public.churches(id) 
    ON DELETE CASCADE;

-- De members vers bergeries
ALTER TABLE public.members 
  DROP CONSTRAINT IF EXISTS members_bergerie_id_fkey,
  ADD CONSTRAINT members_bergerie_id_fkey 
    FOREIGN KEY (bergerie_id) 
    REFERENCES public.bergeries(id) 
    ON DELETE CASCADE;

-- De activities vers bergeries
ALTER TABLE public.activities 
  DROP CONSTRAINT IF EXISTS activities_bergerie_id_fkey,
  ADD CONSTRAINT activities_bergerie_id_fkey 
    FOREIGN KEY (bergerie_id) 
    REFERENCES public.bergeries(id) 
    ON DELETE CASCADE;

-- De invites vers bergeries
ALTER TABLE public.invites 
  DROP CONSTRAINT IF EXISTS invites_bergerie_id_fkey,
  ADD CONSTRAINT invites_bergerie_id_fkey 
    FOREIGN KEY (bergerie_id) 
    REFERENCES public.bergeries(id) 
    ON DELETE CASCADE;

-- 3. RECHARGE DU CACHE
NOTIFY pgrst, 'reload schema';
