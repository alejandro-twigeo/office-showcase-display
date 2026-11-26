-- ───────────────────────────────────────────────────────────────────────
-- Step 2 of 2: lock writes to logged-in Twigeo people
-- Run this only AFTER step 1 has run AND the new app version is published.
--  * everyone (including the TV) can still READ everything the app shows
--  * only people logged in with an @twigeo.com email can WRITE
--  * scores, votes and kudos can only be posted in your own name
--  * setup tables (rounds, locations, scoring, icons) are admin only
--  * nobody can read anyone's email
-- Server functions (daily poll, news, round reset) use the service key and are unaffected.
-- ───────────────────────────────────────────────────────────────────────

-- 1. Every table in the app: reset the rules to "anyone reads, Twigeo people write".
--    Specific tables get stricter rules below.
do $$
declare
  t text;
  pol record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename <> 'people' loop
    execute format('alter table public.%I enable row level security', t);
    for pol in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', pol.policyname, t);
    end loop;
    execute format('create policy "read: everyone" on public.%I for select using (true)', t);
    execute format('create policy "insert: twigeo" on public.%I for insert to authenticated with check (public.is_twigeo())', t);
    execute format('create policy "update: twigeo" on public.%I for update to authenticated using (public.is_twigeo()) with check (public.is_twigeo())', t);
    execute format('create policy "delete: twigeo" on public.%I for delete to authenticated using (public.is_twigeo())', t);
  end loop;
end $$;

-- helper: drop the default write rules on one table so stricter ones can replace them
create or replace function public._lock_strict(t text) returns void language plpgsql as $$
begin
  execute format('drop policy if exists "insert: twigeo" on public.%I', t);
  execute format('drop policy if exists "update: twigeo" on public.%I', t);
  execute format('drop policy if exists "delete: twigeo" on public.%I', t);
end $$;

-- 2. Players: you can only edit your own name, office and avatar. Profiles are created
--    and linked by the login functions. Emails and account links are hidden from everyone.
select public._lock_strict('players');
create policy "update: own profile" on public.players for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke select, insert, update, delete on public.players from anon, authenticated;
grant select (id, name, office, avatar, created_at, updated_at, department) on public.players to anon, authenticated;
grant update (name, office, avatar, updated_at) on public.players to authenticated;

-- 3. Scores and votes: only in your own name. Challenges are stored as "you>them>game".
select public._lock_strict('minigame_scores');
create policy "insert: own scores" on public.minigame_scores for insert to authenticated with check (
  public.is_twigeo() and (player_name = public.my_player_name()
    or (game_id = 'challenge' and player_name like public.my_player_name() || '>%')));
create policy "update: own scores" on public.minigame_scores for update to authenticated
  using (player_name = public.my_player_name()
    or (game_id = 'challenge' and player_name like public.my_player_name() || '>%'))
  with check (player_name = public.my_player_name()
    or (game_id = 'challenge' and player_name like public.my_player_name() || '>%'));
create policy "delete: admin" on public.minigame_scores for delete to authenticated using (public.is_admin());

select public._lock_strict('wordle_scores');
create policy "insert: own" on public.wordle_scores for insert to authenticated with check (player_name = public.my_player_name());
create policy "update: own" on public.wordle_scores for update to authenticated
  using (player_name = public.my_player_name()) with check (player_name = public.my_player_name());
create policy "delete: admin" on public.wordle_scores for delete to authenticated using (public.is_admin());

select public._lock_strict('guesses');
create policy "insert: own" on public.guesses for insert to authenticated with check (player_name = public.my_player_name());
create policy "delete: admin" on public.guesses for delete to authenticated using (public.is_admin());

select public._lock_strict('votes');
create policy "insert: own" on public.votes for insert to authenticated with check (player_name = public.my_player_name());
create policy "update: own" on public.votes for update to authenticated
  using (player_name = public.my_player_name()) with check (player_name = public.my_player_name());
create policy "delete: admin" on public.votes for delete to authenticated using (public.is_admin());

-- 4. Kudos: post in your own name; edit or remove your own (the admin can remove any)
select public._lock_strict('positive_messages');
create policy "insert: own" on public.positive_messages for insert to authenticated with check (created_by = public.my_player_name());
create policy "update: own or admin" on public.positive_messages for update to authenticated
  using (created_by = public.my_player_name() or public.is_admin())
  with check (created_by = public.my_player_name() or public.is_admin());
create policy "delete: admin" on public.positive_messages for delete to authenticated using (public.is_admin());

-- 5. Polls: anyone at Twigeo can add and edit; only the admin deletes
select public._lock_strict('polls');
create policy "insert: twigeo" on public.polls for insert to authenticated with check (public.is_twigeo());
create policy "update: twigeo" on public.polls for update to authenticated using (public.is_twigeo()) with check (public.is_twigeo());
create policy "delete: admin" on public.polls for delete to authenticated using (public.is_admin());

-- 6. Setup tables: admin only (Manager page)
do $$
declare t text;
begin
  foreach t in array array['locations', 'rounds', 'round_schedule', 'scoring_settings', 'daily_news', 'daily_thisorthat'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    perform public._lock_strict(t);
    execute format('create policy "insert: admin" on public.%I for insert to authenticated with check (public.is_admin())', t);
    execute format('create policy "update: admin" on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    execute format('create policy "delete: admin" on public.%I for delete to authenticated using (public.is_admin())', t);
  end loop;
end $$;

-- 7. Visit logs: anyone may add a visit (the TV logs too), nobody edits
do $$
begin
  if to_regclass('public.visit_logs') is not null then
    perform public._lock_strict('visit_logs');
    create policy "insert: everyone" on public.visit_logs for insert with check (true);
  end if;
end $$;

-- 8. Game icon uploads: admin only
drop policy if exists "Anyone can upload game icons" on storage.objects;
drop policy if exists "Anyone can update game icons" on storage.objects;
drop policy if exists "Anyone can delete game icons" on storage.objects;
create policy "Admin uploads game icons" on storage.objects for insert to authenticated
  with check (bucket_id = 'game-icons' and public.is_admin());
create policy "Admin updates game icons" on storage.objects for update to authenticated
  using (bucket_id = 'game-icons' and public.is_admin());
create policy "Admin deletes game icons" on storage.objects for delete to authenticated
  using (bucket_id = 'game-icons' and public.is_admin());

-- 9. The roster: no direct access at all (only the login functions read it)
revoke all on public.people from anon, authenticated;

-- tidy up the helper
drop function if exists public._lock_strict(text);
