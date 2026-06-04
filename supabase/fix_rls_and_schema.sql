-- =============================================================
-- Poimén Patch v1.3 - RLS & Schema Fix for Churches
-- =============================================================

-- 1. ADD MISSING COLUMNS
-- Churches
ALTER TABLE churches ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- Bergeries (Support for pending requests and creators)
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_civility TEXT;
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_first_name TEXT;
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_last_name TEXT;
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_phone TEXT;
ALTER TABLE bergeries ADD COLUMN IF NOT EXISTS creator_role TEXT;

-- 2. ENABLE RLS (Row Level Security)
-- This ensures the table is protected and policies are enforced
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE bergeries ENABLE ROW LEVEL SECURITY;

-- 3. DROP OLD POLICIES (Cleanup)
DROP POLICY IF EXISTS "Super Admin Full Access on Churches" ON churches;
DROP POLICY IF EXISTS "Super Admin Full Access on Bergeries" ON bergeries;
DROP POLICY IF EXISTS "super_admin_all_churches" ON churches;
DROP POLICY IF EXISTS "super_admin_all_bergeries" ON bergeries;
DROP POLICY IF EXISTS "super_admin_all" ON churches;
DROP POLICY IF EXISTS "super_admin_all" ON bergeries;

-- 4. CREATE ROBUST SUPER ADMIN POLICIES
-- Policy for CHURCHES: Allows super admin (by email or role) to do everything
CREATE POLICY "super_admin_all_churches" ON churches
FOR ALL TO authenticated, anon
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
)
WITH CHECK (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- Policy for BERGERIES: Allows super admin (by email or role) to do everything
CREATE POLICY "super_admin_all_bergeries" ON bergeries
FOR ALL TO authenticated, anon
USING (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
)
WITH CHECK (
  (auth.jwt() ->> 'email' = 'iccintegration2025@gmail.com') OR 
  (get_user_role() = 'super_admin')
);

-- 5. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
