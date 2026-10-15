BEGIN;

CREATE TABLE IF NOT EXISTS public.visio_custom_rooms (
  room_name text PRIMARY KEY CHECK (room_name ~ '^poimen-prive-[a-f0-9]{36}$'),
  owner_id uuid NOT NULL,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.visio_custom_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.visio_custom_rooms FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.visio_custom_rooms TO service_role;
COMMENT ON TABLE public.visio_custom_rooms IS 'Server-side ownership and revocation registry for reusable private video rooms.';

COMMIT;
