
-- Add missing columns to youtube_queue
ALTER TABLE public.youtube_queue
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'played'
  CHECK (status IN ('queued', 'playing', 'played'));

ALTER TABLE public.youtube_queue
  ADD COLUMN IF NOT EXISTS queued_at timestamp with time zone DEFAULT now();

-- Migrate existing data
UPDATE public.youtube_queue
SET status = CASE
  WHEN is_playing = true THEN 'playing'
  ELSE 'played'
END;

-- Change default for new inserts
ALTER TABLE public.youtube_queue
  ALTER COLUMN status SET DEFAULT 'queued';
