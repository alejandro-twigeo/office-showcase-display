-- Step 6: the chat is one conversation with one clock.
-- Every new message keeps the whole chat alive. Only when nobody has written for 2 hours
-- does the chat clear: the next message starts a fresh one. Replaces the per-conversation rule from step 4.
create or replace function public.chat_after_post() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  previous_last timestamptz;
begin
  select max(created_at) into previous_last from public.chat_messages where id <> new.id;
  -- The chat had gone quiet for 2 hours: clear it, this message starts a new one
  if previous_last is not null and previous_last < now() - interval '2 hours' then
    delete from public.chat_messages where id <> new.id;
  end if;
  return null;
end $$;
