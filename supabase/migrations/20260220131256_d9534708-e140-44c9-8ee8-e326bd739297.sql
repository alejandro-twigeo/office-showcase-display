
-- Add poll_type column to polls table (default 'choice' keeps existing polls unchanged)
ALTER TABLE public.polls
  ADD COLUMN IF NOT EXISTS poll_type text NOT NULL DEFAULT 'choice';

-- Function to safely append a new option to a freetext poll (atomic, no race conditions)
-- Returns the index of the newly added option
CREATE OR REPLACE FUNCTION public.append_poll_option(p_poll_id uuid, p_option_text text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_options jsonb;
  v_new_index integer;
BEGIN
  -- Lock the row for update to prevent concurrent conflicts
  SELECT options INTO v_options
  FROM public.polls
  WHERE id = p_poll_id AND is_active = true AND poll_type = 'freetext'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Poll not found or not an active freetext poll';
  END IF;

  -- Check if this option text already exists (case-insensitive)
  SELECT i - 1 INTO v_new_index
  FROM jsonb_array_elements_text(v_options) WITH ORDINALITY AS t(val, i)
  WHERE lower(val) = lower(p_option_text)
  LIMIT 1;

  -- If already exists, return its index
  IF v_new_index IS NOT NULL THEN
    RETURN v_new_index;
  END IF;

  -- Append new option and return its index
  v_new_index := jsonb_array_length(v_options);
  UPDATE public.polls
  SET options = v_options || to_jsonb(p_option_text)
  WHERE id = p_poll_id;

  RETURN v_new_index;
END;
$$;
