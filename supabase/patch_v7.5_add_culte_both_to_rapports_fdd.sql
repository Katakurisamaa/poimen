-- =============================================================
-- Migration: Add culte_1_et_2 and disciples_culte_1_et_2 to rapports_fdd
-- Allows tracking members & disciples attending both Culte 1 and Culte 2
-- =============================================================

ALTER TABLE public.rapports_fdd
ADD COLUMN IF NOT EXISTS culte_1_et_2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS disciples_culte_1_et_2 INTEGER DEFAULT 0;
