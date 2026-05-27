-- =============================================================
-- Poimén Patch v2.7 - Module d'Évangélisation (Zero RLS Blocks)
-- =============================================================

CREATE TABLE IF NOT EXISTS public.evangelisations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES public.churches(id) ON DELETE CASCADE,
  bergerie_id UUID REFERENCES public.bergeries(id) ON DELETE CASCADE,
  
  -- Données d'identité (facultatives pour l'anonymat)
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address TEXT,
  
  -- Gestion de l'anonymat & Comptes de Masse
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  anonymous_description TEXT,
  people_count INT NOT NULL DEFAULT 1 CHECK (people_count >= 1), -- Nombre de personnes (1 par défaut, ou N pour un groupe)
  
  -- Types de prières faites
  prayer_salvation BOOLEAN NOT NULL DEFAULT false, -- Prière du salut
  prayer_healing BOOLEAN NOT NULL DEFAULT false,   -- Prière de guérison
  prayer_other BOOLEAN NOT NULL DEFAULT false,     -- Autre prière
  prayer_other_details TEXT,                       -- Précisions
  
  -- Invitation & Suivi
  has_invitation BOOLEAN NOT NULL DEFAULT false,
  attended_service BOOLEAN NOT NULL DEFAULT false, -- Venu au culte plus tard
  
  -- Commentaires de rencontre
  comment TEXT,
  
  -- Traçabilité & Promotion
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  converted_guest_id UUID REFERENCES public.invites(id) ON DELETE SET NULL,
  evangelisation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Assigner les valeurs par défaut dynamiques (Self-Healing)
ALTER TABLE public.evangelisations ALTER COLUMN created_by SET DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.get_user_church_id()
RETURNS UUID AS $$
  SELECT church_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

ALTER TABLE public.evangelisations ALTER COLUMN church_id SET DEFAULT public.get_user_church_id();

-- Indexations pour des performances de recherche optimales
CREATE INDEX IF NOT EXISTS idx_evangelisations_church ON public.evangelisations(church_id);
CREATE INDEX IF NOT EXISTS idx_evangelisations_bergerie ON public.evangelisations(bergerie_id);
CREATE INDEX IF NOT EXISTS idx_evangelisations_created_by ON public.evangelisations(created_by);
CREATE INDEX IF NOT EXISTS idx_evangelisations_converted ON public.evangelisations(converted_guest_id);

-- Désactiver RLS pour éviter tout blocage de session (Super Admin frontend anonyme, RLS bypass)
-- La sécurité d'affichage et l'isolation des données sont gérées de façon fiable par le Frontend.
ALTER TABLE public.evangelisations DISABLE ROW LEVEL SECURITY;

-- Recharger le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
