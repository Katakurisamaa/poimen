-- =============================================================
-- Poimén Helper - Reset Super Admin Password
-- =============================================================
-- Ce script permet de réinitialiser le mot de passe de l'administrateur
-- central (minkojunior400@gmail.com) directement dans Supabase.
--
-- INSTRUCTIONS :
-- 1. Copiez ce script SQL.
-- 2. Allez dans la console Supabase de votre projet.
-- 3. Ouvrez le "SQL Editor" et créez une nouvelle requête.
-- 4. Remplacez 'votre_nouveau_mot_de_passe' par le mot de passe de votre choix.
-- 5. Exécutez la requête.

UPDATE auth.users 
SET encrypted_password = crypt('votre_nouveau_mot_de_passe', gen_salt('bf')) 
WHERE email = 'minkojunior400@gmail.com';

-- Optionnel : s'assurer que le profil est également à jour
UPDATE public.profiles
SET active = true, role = 'super_admin'
WHERE email = 'minkojunior400@gmail.com';
