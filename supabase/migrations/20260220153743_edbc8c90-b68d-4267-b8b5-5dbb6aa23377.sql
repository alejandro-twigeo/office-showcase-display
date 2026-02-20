
-- Playlists table
CREATE TABLE public.playlists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Playlist items table
CREATE TABLE public.playlist_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playlist_id uuid NOT NULL REFERENCES public.playlists(id) ON DELETE CASCADE,
  video_id text NOT NULL,
  title text NOT NULL,
  thumbnail_url text,
  channel_title text,
  added_by text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_playlist_items_playlist_id ON public.playlist_items(playlist_id);
CREATE INDEX idx_playlist_items_position ON public.playlist_items(playlist_id, position);

-- Enable RLS
ALTER TABLE public.playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playlist_items ENABLE ROW LEVEL SECURITY;

-- Playlists policies (public read/write, no auth required - same pattern as guesses/polls)
CREATE POLICY "Anyone can read playlists"
  ON public.playlists FOR SELECT USING (true);

CREATE POLICY "Anyone can insert playlists"
  ON public.playlists FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update playlists"
  ON public.playlists FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete playlists"
  ON public.playlists FOR DELETE USING (true);

-- Playlist items policies
CREATE POLICY "Anyone can read playlist_items"
  ON public.playlist_items FOR SELECT USING (true);

CREATE POLICY "Anyone can insert playlist_items"
  ON public.playlist_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can delete playlist_items"
  ON public.playlist_items FOR DELETE USING (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_playlists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_playlists_updated_at
  BEFORE UPDATE ON public.playlists
  FOR EACH ROW EXECUTE FUNCTION public.update_playlists_updated_at();
