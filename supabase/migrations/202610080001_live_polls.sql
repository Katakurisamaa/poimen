-- Additive migration: no existing data or tables are modified.
BEGIN;
CREATE TABLE IF NOT EXISTS public.visio_poll_rooms (
  room_name text PRIMARY KEY CHECK (length(room_name) BETWEEN 3 AND 180),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  state jsonb NOT NULL DEFAULT '{"polls":[]}'::jsonb CHECK (jsonb_typeof(state -> 'polls') = 'array'),
  version integer NOT NULL DEFAULT 0 CHECK (version >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.visio_poll_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visio_poll_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.visio_poll_rooms TO service_role;
COMMENT ON TABLE public.visio_poll_rooms IS 'Server-only poll state. Updates compare versions to prevent duplicate votes and lost writes.';
COMMIT;
