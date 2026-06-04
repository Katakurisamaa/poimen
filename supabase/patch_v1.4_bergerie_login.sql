-- =============================================================
-- Poimén Patch v1.4 - Bergerie Login & RLS Fix
-- =============================================================

-- 1. SCHÉMA : AJOUT DES COLONNES DE CONNEXION
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_email TEXT;
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Index pour la performance
CREATE INDEX IF NOT EXISTS idx_bergeries_login ON bergeries (creator_email, access_code);

-- 2. RLS : ACCÈS PUBLIC POUR LA NAVIGATION ET LA CONNEXION
-- Les églises doivent être visibles par tous pour être sélectionnées à l'accueil
DROP POLICY IF EXISTS "Allow public read for churches" ON churches;
CREATE POLICY "Allow public read for churches" ON churches
FOR SELECT TO authenticated, anon
USING (true);

-- Les bergeries actives doivent être visibles pour que les responsables puissent s'y connecter
DROP POLICY IF EXISTS "Allow public read for active bergeries" ON bergeries;
CREATE POLICY "Allow public read for active bergeries" ON bergeries
FOR SELECT TO authenticated, anon
USING (status = 'active');

-- Autoriser tout le monde à proposer une nouvelle bergerie (elle sera en 'pending')
DROP POLICY IF EXISTS "Allow public insert for bergeries" ON bergeries;
CREATE POLICY "Allow public insert for bergeries" ON bergeries
FOR INSERT TO authenticated, anon
WITH CHECK (status = 'pending');

-- 3. RLS : GARDIR LE PLEIN ACCÈS POUR LE SUPER ADMIN
-- (Email : iccintegration2025@gmail.com)
DROP POLICY IF EXISTS "super_admin_all_churches" ON churches;
CREATE POLICY "super_admin_all_churches_v2" ON churches
FOR ALL TO authenticated, anon
USING (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com');

DROP POLICY IF EXISTS "super_admin_all_bergeries" ON bergeries;
CREATE POLICY "super_admin_all_bergeries_v2" ON bergeries
FOR ALL TO authenticated, anon
USING (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com')
WITH CHECK (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com');

-- 4. REFRESH
NOTIFY pgrst, 'reload schema';
