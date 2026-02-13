-- Restrict direct poll deactivation and enforce password-protected close via RPC
DROP POLICY IF EXISTS "Anyone can update polls" ON public.polls;

CREATE POLICY "Anyone can update active polls" ON public.polls
FOR UPDATE
USING (true)
WITH CHECK (is_active = true);

CREATE OR REPLACE FUNCTION public.close_poll_with_password(p_poll_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_password <> '1234' THEN
    RAISE EXCEPTION 'Incorrect password';
  END IF;

  UPDATE public.polls
  SET is_active = false
  WHERE id = p_poll_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.close_poll_with_password(uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.close_poll_with_password(uuid, text) TO authenticated;
