
-- Add wordle_points to scoring_settings (default 20)
ALTER TABLE public.scoring_settings ADD COLUMN IF NOT EXISTS wordle_points integer NOT NULL DEFAULT 20;

-- Create wordle_scores table to track player completions per round
CREATE TABLE public.wordle_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  device_id text NOT NULL,
  attempts integer NOT NULL,
  solved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_name)
);

ALTER TABLE public.wordle_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read wordle_scores" ON public.wordle_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert wordle_scores" ON public.wordle_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update wordle_scores" ON public.wordle_scores FOR UPDATE USING (true) WITH CHECK (true);

-- Add a word column to rounds for the daily wordle word
ALTER TABLE public.rounds ADD COLUMN IF NOT EXISTS wordle_word text;
