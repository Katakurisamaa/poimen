-- Patch v1.8: Adding all missing follow-up fields to invites table
ALTER TABLE invites ADD COLUMN IF NOT EXISTS a_ete_invite BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS par_qui TEXT;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_cdm BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS integre_cdm BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS priere_partage BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS dans_famille_disciple BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_bapteme BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS commentaire_suivi TEXT;

-- Backup check for v1.7 fields just in case
ALTER TABLE invites ADD COLUMN IF NOT EXISTS sms_bienvenue BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS priere BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_evenement BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_formation BOOLEAN DEFAULT false;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
