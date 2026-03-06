ALTER TABLE public.scoring_settings
ADD COLUMN wordle_attempt_points jsonb NOT NULL DEFAULT '[20, 18, 15, 12, 10, 8]'::jsonb;