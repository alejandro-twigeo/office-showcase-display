
-- Trigger that blocks direct is_active=false updates.
-- The close_poll() function runs as SECURITY DEFINER and sets a local config
-- flag so the trigger knows to allow it.

CREATE OR REPLACE FUNCTION public.guard_poll_close()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only guard when is_active is flipped to false
  IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false THEN
    -- Allow if the close_poll function set the bypass flag
    IF current_setting('app.allow_poll_close', true) = 'true' THEN
      RETURN NEW;
    END IF;
    -- Block direct updates
    RAISE EXCEPTION 'Polls can only be closed via the close_poll function';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_poll_close_trigger
BEFORE UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.guard_poll_close();

-- Update close_poll to set the bypass flag before updating
CREATE OR REPLACE FUNCTION public.close_poll(p_poll_id uuid, p_reason text, p_source text, p_closed_by text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set bypass flag so the guard trigger allows this update
  PERFORM set_config('app.allow_poll_close', 'true', true);
  
  UPDATE public.polls
  SET
    is_active = false,
    closed_at = now(),
    closed_reason = p_reason,
    closed_source = p_source,
    closed_by = coalesce(p_closed_by, 'unknown')
  WHERE id = p_poll_id;
END;
$$;
