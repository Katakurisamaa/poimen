-- ─── INVITES ───
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bergerie_id UUID NOT NULL REFERENCES bergeries(id),
  civility TEXT NOT NULL CHECK (civility IN ('M.','Mme.', 'Mlle.')),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  age TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  arrival_date DATE NOT NULL DEFAULT CURRENT_DATE,
  event TEXT DEFAULT 'Culte',
  aps BOOLEAN DEFAULT false,
  local_church BOOLEAN DEFAULT false,
  responsible TEXT DEFAULT 'Non assigné',
  is_in_bergerie BOOLEAN DEFAULT false,
  status TEXT,
  attendance JSONB DEFAULT '{}',
  -- Suivi Fields
  appel_abouti BOOLEAN DEFAULT false,
  groupe_whatsapp BOOLEAN DEFAULT false,
  prevu_revenir BOOLEAN DEFAULT false,
  est_revenu_culte BOOLEAN DEFAULT false,
  rencontre_effectuee BOOLEAN DEFAULT false,
  visite_domicile BOOLEAN DEFAULT false,
  cocktail_bienvenue BOOLEAN DEFAULT false,
  pcnc BOOLEAN DEFAULT false,
  p101 BOOLEAN DEFAULT false,
  p201 BOOLEAN DEFAULT false,
  p301 BOOLEAN DEFAULT false,
  termine_pcnc BOOLEAN DEFAULT false,
  bapteme_eau BOOLEAN DEFAULT false,
  bapteme_esprit BOOLEAN DEFAULT false,
  veut_servir BOOLEAN DEFAULT false,
  devenu_star BOOLEAN DEFAULT false,
  commentaire TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_invites_bergerie ON invites(bergerie_id);

-- RLS
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_invites" ON invites FOR ALL USING (get_user_role() = 'super_admin');
CREATE POLICY "berger_invites" ON invites FOR ALL 
  USING (bergerie_id = get_user_bergerie() AND get_user_role() IN ('berger','coordonnateur', 'second'));
CREATE POLICY "resp_invites" ON invites FOR ALL
  USING (bergerie_id = get_user_bergerie() AND get_user_role() = 'responsable');
