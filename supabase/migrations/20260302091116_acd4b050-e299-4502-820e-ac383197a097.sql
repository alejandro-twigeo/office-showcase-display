
-- Single-row config table for daily auto-reset schedule
CREATE TABLE public.round_schedule (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT false,
  reset_hour integer NOT NULL DEFAULT 8 CHECK (reset_hour >= 0 AND reset_hour <= 23),
  last_auto_reset_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO public.round_schedule (id, enabled, reset_hour) VALUES (1, false, 8);

-- Enable RLS
ALTER TABLE public.round_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read round_schedule" ON public.round_schedule FOR SELECT USING (true);
CREATE POLICY "Anyone can update round_schedule" ON public.round_schedule FOR UPDATE USING (true) WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.round_schedule;
