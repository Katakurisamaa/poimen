-- Poimén Patch v3.9 - Ajout des champs détaillés pour les membres de la bergerie
--
-- Exécutez ce script dans l'éditeur SQL de votre console Supabase pour ajouter 
-- les nouveaux champs requis sans aucune perte de données existantes.

ALTER TABLE members ADD COLUMN IF NOT EXISTS date_entree DATE DEFAULT CURRENT_DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS date_anniversaire TEXT; -- Format JJ/MM
ALTER TABLE members ADD COLUMN IF NOT EXISTS adresse TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS profession TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS etat_civil TEXT CHECK (etat_civil IN ('Célibataire', 'Marié(e)', 'En couple', 'Séparé(e)', 'Veuf(ve)', 'Divorcé(e)'));
ALTER TABLE members ADD COLUMN IF NOT EXISTS a_enfants BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS nombre_enfants INTEGER DEFAULT 0;
ALTER TABLE members ADD COLUMN IF NOT EXISTS est_baptise BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS formations TEXT[] DEFAULT '{}'; -- Tableau pour stocker les formations ('001', '101', '201', '301')
ALTER TABLE members ADD COLUMN IF NOT EXISTS est_star BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS departement_star TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS est_cdm BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS pilote_cdm TEXT;

-- Rechargement du schéma postgrest pour notifier le client d'API
NOTIFY pgrst, 'reload schema';
