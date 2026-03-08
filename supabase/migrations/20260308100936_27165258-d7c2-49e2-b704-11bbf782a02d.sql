
-- Create storage bucket for game icons
INSERT INTO storage.buckets (id, name, public) VALUES ('game-icons', 'game-icons', true);

-- Allow anyone to read game icons
CREATE POLICY "Anyone can read game icons" ON storage.objects FOR SELECT USING (bucket_id = 'game-icons');

-- Allow anyone to upload game icons
CREATE POLICY "Anyone can upload game icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'game-icons');

-- Allow anyone to update game icons
CREATE POLICY "Anyone can update game icons" ON storage.objects FOR UPDATE USING (bucket_id = 'game-icons');

-- Allow anyone to delete game icons
CREATE POLICY "Anyone can delete game icons" ON storage.objects FOR DELETE USING (bucket_id = 'game-icons');

-- Add game_icons jsonb column to scoring_settings
ALTER TABLE public.scoring_settings ADD COLUMN game_icons jsonb NOT NULL DEFAULT '{}'::jsonb;
