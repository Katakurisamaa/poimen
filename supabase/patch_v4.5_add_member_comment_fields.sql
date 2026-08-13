-- Poimén Patch v4.5 - Ajout des champs de commentaires pour le tableau membre de la bergerie
-- (commentaire_cdm, commentaire_pcnc, commentaire_star)

ALTER TABLE members ADD COLUMN IF NOT EXISTS commentaire_cdm TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS commentaire_pcnc TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS commentaire_star TEXT;

-- Rechargement du schéma postgrest pour notifier le client d'API Supabase
NOTIFY pgrst, 'reload schema';
