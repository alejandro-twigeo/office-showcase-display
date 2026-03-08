
CREATE POLICY "Anyone can update votes"
ON public.votes
FOR UPDATE
USING (true)
WITH CHECK (true);
