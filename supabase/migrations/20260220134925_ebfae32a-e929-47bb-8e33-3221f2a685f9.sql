
CREATE TABLE public.scoring_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  distance_parameter numeric NOT NULL DEFAULT 500,
  attempt_multipliers jsonb NOT NULL DEFAULT '[1.0, 0.9, 0.82, 0.75, 0.70]'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Seed the single row
INSERT INTO public.scoring_settings (id, distance_parameter, attempt_multipliers)
VALUES (1, 500, '[1.0, 0.9, 0.82, 0.75, 0.70]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS
ALTER TABLE public.scoring_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read scoring settings
CREATE POLICY "Anyone can read scoring_settings"
  ON public.scoring_settings FOR SELECT
  USING (true);

-- Anyone can update scoring settings (password enforced in UI)
CREATE POLICY "Anyone can update scoring_settings"
  ON public.scoring_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);
