-- =============================================================
-- Poimén Patch v3.7 - Add Activities Template to Bergeries
-- =============================================================

-- 1. ADD COLUMN TO STORE ACTIVITIES TEMPLATES SHARED BY ALL LEADERS IN THE SAME FAMILY
ALTER TABLE public.bergeries 
ADD COLUMN IF NOT EXISTS activities JSONB 
DEFAULT '[{"id": "culte", "name": "Culte du Dimanche", "day": 0, "startTime": "10:00", "endTime": "12:30", "location": "Sanctuaire Principal"}, {"id": "cdm", "name": "CDM (Cellule Alpha)", "day": 4, "startTime": "19:00", "endTime": "20:30", "location": "Salles Annexes"}]'::jsonb;

-- 2. REFRESH SCHEMA FOR POSTGREST
NOTIFY pgrst, 'reload schema';
