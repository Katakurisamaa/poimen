-- Patch v1.7: Adding missing follow-up fields to invites table
ALTER TABLE invites ADD COLUMN IF NOT EXISTS sms_bienvenue BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS priere BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_evenement BOOLEAN DEFAULT false;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS interet_formation BOOLEAN DEFAULT false;

-- Ensure RLS is active for all new columns (inherited by default)
-- No special RLS changes needed as policy uses ALL
