
CREATE TABLE public.positive_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.positive_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active positive_messages"
  ON public.positive_messages FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert positive_messages"
  ON public.positive_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update positive_messages"
  ON public.positive_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.positive_messages;
