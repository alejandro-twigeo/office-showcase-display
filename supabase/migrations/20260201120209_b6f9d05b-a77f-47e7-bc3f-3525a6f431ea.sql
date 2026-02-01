-- Create locations table for GeoGuessr images
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    pano_id TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create guesses table
CREATE TABLE public.guesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID REFERENCES public.locations(id) ON DELETE CASCADE NOT NULL,
    player_name TEXT NOT NULL,
    device_id TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    guess_number INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create polls table
CREATE TABLE public.polls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    created_by TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create votes table
CREATE TABLE public.votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    poll_id UUID REFERENCES public.polls(id) ON DELETE CASCADE NOT NULL,
    device_id TEXT NOT NULL,
    player_name TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(poll_id, device_id)
);

-- Create youtube_queue table
CREATE TABLE public.youtube_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id TEXT NOT NULL,
    title TEXT NOT NULL,
    queued_by TEXT NOT NULL,
    is_playing BOOLEAN DEFAULT false,
    played_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables (but allow public access since no auth)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_queue ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth required per plan)
CREATE POLICY "Anyone can read locations" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert locations" ON public.locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update locations" ON public.locations FOR UPDATE USING (true);

CREATE POLICY "Anyone can read guesses" ON public.guesses FOR SELECT USING (true);
CREATE POLICY "Anyone can insert guesses" ON public.guesses FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Anyone can insert polls" ON public.polls FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update polls" ON public.polls FOR UPDATE USING (true);

CREATE POLICY "Anyone can read votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Anyone can insert votes" ON public.votes FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read youtube_queue" ON public.youtube_queue FOR SELECT USING (true);
CREATE POLICY "Anyone can insert youtube_queue" ON public.youtube_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update youtube_queue" ON public.youtube_queue FOR UPDATE USING (true);

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.youtube_queue;