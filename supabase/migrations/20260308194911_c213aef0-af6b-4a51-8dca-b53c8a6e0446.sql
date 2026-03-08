ALTER TABLE public.visit_logs ADD COLUMN player_name text;
ALTER TABLE public.visit_logs ALTER COLUMN device_id DROP NOT NULL;