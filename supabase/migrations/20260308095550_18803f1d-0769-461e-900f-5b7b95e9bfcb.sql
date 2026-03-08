
-- General minigame scores table
CREATE TABLE public.minigame_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  player_name text NOT NULL,
  device_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(game_id, date, player_name)
);

ALTER TABLE public.minigame_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read minigame_scores" ON public.minigame_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can insert minigame_scores" ON public.minigame_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update minigame_scores" ON public.minigame_scores FOR UPDATE USING (true) WITH CHECK (true);

-- Add minigame scoring settings columns to scoring_settings
ALTER TABLE public.scoring_settings
  ADD COLUMN IF NOT EXISTS city_guess_distance_param numeric NOT NULL DEFAULT 200,
  ADD COLUMN IF NOT EXISTS city_guess_max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS city_guess_attempt_multipliers jsonb NOT NULL DEFAULT '[1.0, 0.75, 0.5]'::jsonb,
  ADD COLUMN IF NOT EXISTS thisorthat_points_per_q integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS thisorthat_streak_bonus numeric NOT NULL DEFAULT 0.2,
  ADD COLUMN IF NOT EXISTS sudoku_max_points integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS sudoku_time_param integer NOT NULL DEFAULT 300,
  ADD COLUMN IF NOT EXISTS pairs_max_points integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS pairs_time_param integer NOT NULL DEFAULT 120,
  ADD COLUMN IF NOT EXISTS pairs_move_penalty integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS labyrinth_max_points integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS labyrinth_time_param integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS labyrinth_reset_penalty integer NOT NULL DEFAULT 5;

-- Enable realtime for minigame_scores
ALTER PUBLICATION supabase_realtime ADD TABLE public.minigame_scores;
