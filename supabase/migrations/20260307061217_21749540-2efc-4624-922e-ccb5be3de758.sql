
CREATE TABLE public.daily_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date date UNIQUE NOT NULL,
  run_datetime timestamptz,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily_news" ON public.daily_news
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert daily_news" ON public.daily_news
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update daily_news" ON public.daily_news
  FOR UPDATE USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_news;
