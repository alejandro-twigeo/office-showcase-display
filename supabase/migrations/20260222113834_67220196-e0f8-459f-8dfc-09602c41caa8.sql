
-- Players table for simple user identity
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  password_text TEXT NOT NULL,
  office TEXT NOT NULL DEFAULT 'Bulgaria' CHECK (office IN ('Bulgaria', 'Sweden', 'US')),
  avatar TEXT NOT NULL DEFAULT '🐶',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Anyone can read players (for leaderboards)
CREATE POLICY "Anyone can read players"
  ON public.players FOR SELECT USING (true);

-- Anyone can insert (signup)
CREATE POLICY "Anyone can insert players"
  ON public.players FOR INSERT WITH CHECK (true);

-- Anyone can update (profile editing - app enforces ownership via name/password)
CREATE POLICY "Anyone can update players"
  ON public.players FOR UPDATE USING (true) WITH CHECK (true);

-- Add difficulty_weights to scoring_settings
ALTER TABLE public.scoring_settings
  ADD COLUMN IF NOT EXISTS difficulty_weights JSONB NOT NULL DEFAULT '{"easy": 1.0, "hard": 1.2}'::jsonb;

-- Add max_guesses_per_challenge (null = unlimited)
ALTER TABLE public.scoring_settings
  ADD COLUMN IF NOT EXISTS max_guesses_per_challenge INTEGER DEFAULT NULL;

-- Enable realtime for players
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
