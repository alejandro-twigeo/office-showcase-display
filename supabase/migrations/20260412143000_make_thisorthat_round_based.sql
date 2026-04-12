ALTER TABLE public.daily_thisorthat
ADD COLUMN IF NOT EXISTS round_id uuid REFERENCES public.rounds(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS daily_thisorthat_round_id_key
ON public.daily_thisorthat (round_id);
