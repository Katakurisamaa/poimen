-- Patch v4.6: Add commentaire_baptise column to members table
ALTER TABLE members ADD COLUMN IF NOT EXISTS commentaire_baptise TEXT;

-- Reload Supabase REST API schema cache
NOTIFY pgrst, 'reload schema';
