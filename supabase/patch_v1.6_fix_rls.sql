-- =============================================================
-- Poimén Patch v1.6 - Fix RLS Policies for Invites & Members
-- =============================================================

-- 1. S'assurer que RLS est activé sur les tables critiques
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churches ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques potentiellement conflictuelles (optionnel mais recommandé)
DROP POLICY IF EXISTS "Allow anonymous insert on invites" ON public.invites;
DROP POLICY IF EXISTS "Allow anonymous select on invites" ON public.invites;
DROP POLICY IF EXISTS "Allow anonymous insert on members" ON public.members;
DROP POLICY IF EXISTS "Allow anonymous select on members" ON public.members;
DROP POLICY IF EXISTS "Allow anonymous update on members" ON public.members;
DROP POLICY IF EXISTS "Allow anonymous select on churches" ON public.churches;

-- 3. Créer des politiques permettant l'accès via la clé "anon" 
-- Note: Dans une application utilisant une authentification personnalisée (email/code), 
-- la clé anon est utilisée pour toutes les requêtes.

-- Politiques pour la table 'invites'
CREATE POLICY "Allow anonymous insert on invites" 
ON public.invites FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "Allow anonymous select on invites" 
ON public.invites FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow anonymous update on invites" 
ON public.invites FOR UPDATE 
TO anon 
USING (true);

-- Politiques pour la table 'members'
CREATE POLICY "Allow anonymous insert on members" 
ON public.members FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "Allow anonymous select on members" 
ON public.members FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow anonymous update on members" 
ON public.members FOR UPDATE 
TO anon 
USING (true);

-- Politiques pour la table 'churches' (pour éviter l'erreur mentionnée précédemment)
CREATE POLICY "Allow anonymous select on churches" 
ON public.churches FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow anonymous insert on churches" 
ON public.churches FOR INSERT 
TO anon 
WITH CHECK (true);

-- Politiques pour la table 'profiles' (utilisée pour le login)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous select on profiles" ON public.profiles;
CREATE POLICY "Allow anonymous select on profiles" 
ON public.profiles FOR SELECT 
TO anon 
USING (true);
