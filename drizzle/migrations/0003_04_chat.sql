-- ───────────────────────────────────────────────────────────────────────
-- Step 4: office chat
--  * a message starts a conversation; replies belong to it (one level, like a thread)
--  * a conversation disappears 2 hours after its last message: every reply restarts the clock
--  * anyone can read (the TV shows it); only logged-in Twigeo people post, in their own name
--  * you can delete your own messages; the admin can delete any
-- ───────────────────────────────────────────────────────────────────────

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  -- null: this message starts a conversation. Otherwise: the conversation it replies to.
  thread_id uuid references public.chat_messages(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 140),
  created_by text not null,
  created_at timestamptz not null default now(),
  -- on conversation starters: when the conversation last had a message (replies move it on)
  last_activity_at timestamptz not null default now()
);
create index if not exists chat_messages_thread_idx on public.chat_messages (thread_id);
create index if not exists chat_messages_activity_idx on public.chat_messages (last_activity_at);

alter table public.chat_messages enable row level security;

drop policy if exists "read: everyone" on public.chat_messages;
drop policy if exists "post: own name" on public.chat_messages;
drop policy if exists "delete: own or admin" on public.chat_messages;

create policy "read: everyone" on public.chat_messages for select using (true);

-- Is this conversation still going? (started it, and had a message in the last 2 hours)
create or replace function public.chat_thread_open(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_messages
     where id = p_id and thread_id is null and last_activity_at > now() - interval '2 hours'
  )
$$;
grant execute on function public.chat_thread_open(uuid) to authenticated;

-- Post in your own name; replies only to a conversation that's still going
create policy "post: own name" on public.chat_messages for insert to authenticated with check (
  public.is_twigeo()
  and created_by = public.my_player_name()
  and (thread_id is null or public.chat_thread_open(thread_id))
);

create policy "delete: own or admin" on public.chat_messages for delete to authenticated
  using (created_by = public.my_player_name() or public.is_admin());

-- Nobody edits messages; the clock is moved on by the database itself
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to anon, authenticated;
grant insert (thread_id, body, created_by) on public.chat_messages to authenticated;
grant delete on public.chat_messages to authenticated;

-- A reply restarts its conversation's 2-hour clock, and old conversations are cleared away
create or replace function public.chat_after_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.thread_id is not null then
    update public.chat_messages set last_activity_at = now() where id = new.thread_id;
  end if;
  delete from public.chat_messages
   where thread_id is null and last_activity_at < now() - interval '2 hours';
  return null;
end $$;

drop trigger if exists chat_after_post on public.chat_messages;
create trigger chat_after_post after insert on public.chat_messages
  for each row execute function public.chat_after_post();

-- Live updates for the TV and phones
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_messages') then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end $$;
