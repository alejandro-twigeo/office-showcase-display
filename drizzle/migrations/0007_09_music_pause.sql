-- Step 9: pause and stop for the shared music.
-- Pause stops the clock for everyone: the song keeps its place, and when it resumes, its start time
-- moves forward by however long it was paused, so every screen picks up exactly where it stopped.
-- Stop ends the music: the song stops and the queue is cleared. Only logged-in people can do either.

alter table public.youtube_queue add column if not exists paused_at timestamptz;
alter table public.youtube_queue add column if not exists paused_by text;

create or replace function public.music_pause() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.youtube_queue
     set paused_at = now(), paused_by = public.my_player_name()
   where status = 'playing' and paused_at is null and coalesce(is_deleted, false) = false;
end $$;

create or replace function public.music_resume() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.youtube_queue
     set started_at = coalesce(started_at, now()) + (now() - paused_at), paused_at = null, paused_by = null
   where status = 'playing' and paused_at is not null;
end $$;

-- Stop: the song playing ends and everything waiting is cleared (YouTube Mix songs too)
create or replace function public.music_stop() returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.youtube_queue
     set status = 'played', is_playing = false, played_at = now(), paused_at = null, paused_by = null
   where status = 'playing';
  update public.youtube_queue set is_deleted = true where status = 'queued';
end $$;

-- Catching up skips a paused song: its time stands still until someone resumes it
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
    if cur.paused_at is not null then return; end if;
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

revoke all on function public.music_pause() from public, anon;
revoke all on function public.music_resume() from public, anon;
revoke all on function public.music_stop() from public, anon;
grant execute on function public.music_pause() to authenticated;
grant execute on function public.music_resume() to authenticated;
grant execute on function public.music_stop() to authenticated;
grant execute on function public.music_catch_up() to anon, authenticated;
