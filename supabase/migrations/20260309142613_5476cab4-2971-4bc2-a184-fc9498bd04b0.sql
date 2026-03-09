
CREATE TABLE public.daily_thisorthat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date NOT NULL UNIQUE,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_thisorthat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily_thisorthat" ON public.daily_thisorthat FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert daily_thisorthat" ON public.daily_thisorthat FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can update daily_thisorthat" ON public.daily_thisorthat FOR UPDATE TO public USING (true) WITH CHECK (true);
