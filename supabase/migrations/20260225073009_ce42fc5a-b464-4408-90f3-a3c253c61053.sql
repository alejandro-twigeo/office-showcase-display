
-- Create rounds table
CREATE TABLE public.rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number SERIAL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Anyone can insert rounds" ON public.rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update rounds" ON public.rounds FOR UPDATE USING (true);

-- Add round_id to locations
ALTER TABLE public.locations ADD COLUMN round_id UUID REFERENCES public.rounds(id);

-- Enable realtime for rounds
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
