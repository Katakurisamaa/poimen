-- Migration: Add new guest fields (etat_civil and souhaite_etre_contacte)
ALTER TABLE public.invites
ADD COLUMN IF NOT EXISTS etat_civil TEXT,
ADD COLUMN IF NOT EXISTS souhaite_etre_contacte BOOLEAN DEFAULT true;

-- Update existing rows to have default value for contact preference if empty
UPDATE public.invites 
SET souhaite_etre_contacte = true 
WHERE souhaite_etre_contacte IS NULL;
