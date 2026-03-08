
CREATE TABLE public.visit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  visited_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.visit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert visit_logs" ON public.visit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read visit_logs" ON public.visit_logs FOR SELECT USING (true);

CREATE INDEX idx_visit_logs_visited_at ON public.visit_logs (visited_at);
CREATE INDEX idx_visit_logs_device_id ON public.visit_logs (device_id);
