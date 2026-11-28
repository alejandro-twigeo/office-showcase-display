-- Step 8: the shared music runs on the server's clock.
-- Every song that starts playing gets the time it started, and (once known) its length. Every screen
-- works out where the song is from the clock, so all screens are in sync, and a song is over at
-- start + length whether anyone is watching or not. Nothing pauses: what's missed is missed.

alter table public.youtube_queue add column if not exists started_at timestamptz;
alter table public.youtube_queue add column if not exists duration_seconds integer;

-- Whenever a song becomes the one playing (from any screen or function), note when it started,
-- unless the update sets the start itself (catching up sets it to when the previous song ended)
create or replace function public.youtube_queue_mark_start() returns trigger
language plpgsql as $$
begin
  if new.status = 'playing' then
    if tg_op = 'INSERT' then
      new.started_at := coalesce(new.started_at, now());
    elsif old.status is distinct from 'playing' and new.started_at is not distinct from old.started_at then
      new.started_at := now();
    end if;
  end if;
  return new;
end $$;

drop trigger if exists youtube_queue_mark_start on public.youtube_queue;
create trigger youtube_queue_mark_start before insert or update on public.youtube_queue
  for each row execute function public.youtube_queue_mark_start();

-- Moving on: only if that song is still the one playing. Two screens reaching the end of the same
-- song used to skip two songs; now the second call does nothing.
create or replace function public.tv_advance_queue(p_current uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  if p_current is not null and not exists (
    select 1 from public.youtube_queue where id = p_current and status = 'playing'
  ) then
    return;
  end if;
  update public.youtube_queue
     set status = 'played', is_playing = false, played_at = now()
   where (p_current is not null and id = p_current) or (p_current is null and status = 'playing');
  select id into nxt from public.youtube_queue
   where status = 'queued' and coalesce(is_deleted, false) = false
   order by queued_at asc limit 1;
  if nxt is not null then
    update public.youtube_queue set status = 'playing', is_playing = true, current_time_seconds = 0 where id = nxt;
  end if;
end $$;

-- A screen tells the length of the song once its player knows it (songs from YouTube Mix come with it)
create or replace function public.tv_set_duration(p_id uuid, p_seconds integer) returns void
language sql security definer set search_path = public as $$
  update public.youtube_queue set duration_seconds = p_seconds
   where id = p_id and duration_seconds is null and p_seconds between 1 and 6 * 3600
$$;

-- Catching up: any screen that opens (or is open) calls this. Songs whose time is over count as
-- played, and the next one starts when the previous one ended, as if the music never stopped.
-- It stops at a song whose length isn't known yet: the player finds out when it loads it.
create or replace function public.music_catch_up() returns void
language plpgsql security definer set search_path = public as $$
declare
  cur public.youtube_queue%rowtype;
  ends timestamptz;
  nxt uuid;
begin
  for i in 1..60 loop
    select * into cur from public.youtube_queue
     where status = 'playing' and coalesce(is_deleted, false) = false
     order by started_at asc nulls last limit 1;
    if not found then return; end if;
    if cur.started_at is null then
      update public.youtube_queue set started_at = now() where id = cur.id;
      return;
    end if;
    if cur.duration_seconds is null then return; end if;
    ends := cur.started_at + make_interval(secs => cur.duration_seconds);
    if ends > now() then return; end if;
    update public.youtube_queue set status = 'played', is_playing = false, played_at = ends where id = cur.id;
    select id into nxt from public.youtube_queue
     where status = 'queued' and coalesce(is_deleted, false) = false
     order by queued_at asc limit 1;
    if nxt is null then return; end if;
    update public.youtube_queue
       set status = 'playing', is_playing = true, started_at = ends, current_time_seconds = 0
     where id = nxt;
  end loop;
end $$;

grant execute on function public.tv_advance_queue(uuid) to anon, authenticated;
grant execute on function public.tv_set_duration(uuid, integer) to anon, authenticated;
grant execute on function public.music_catch_up() to anon, authenticated;
