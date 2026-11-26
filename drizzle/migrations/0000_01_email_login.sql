-- ───────────────────────────────────────────────────────────────────────
-- Step 1 of 2: email login (safe to run any time, nothing gets locked here)
--  * players get email, user_id (the logged-in account), department, is_admin
--  * a roster of the team: email, full name, department, office. Nothing else.
--  * existing profiles are matched to the roster by first or full name
--  * old plaintext passwords are wiped
--  * functions the app calls to log in, claim a profile or create one
--  * two narrow functions the TV uses for the music queue (it never logs in)
-- ───────────────────────────────────────────────────────────────────────

-- 1. Who each profile belongs to
alter table public.players add column if not exists email text;
alter table public.players add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.players add column if not exists department text;
alter table public.players add column if not exists is_admin boolean not null default false;
create unique index if not exists players_email_key on public.players (lower(email));
create unique index if not exists players_user_id_key on public.players (user_id);
alter table public.players alter column password_text drop not null;

-- 2. The team roster (read only by the functions below, never by the app directly)
create table if not exists public.people (
  email text primary key,
  full_name text not null,
  department text not null,
  office text
);
alter table public.people enable row level security;

insert into public.people (email, full_name, department, office) values
  ('alejandro@twigeo.com', 'Alejandro Sánchez', 'Analytics', 'Sweden'),
  ('asma@twigeo.com', 'Asma Abdollah Poor', 'Analytics', 'Sweden'),
  ('hart@twigeo.com', 'Connor Hart', 'Analytics', 'US'),
  ('daijiro@twigeo.com', 'Daijiro Yokota', 'Analytics', 'US'),
  ('grzegorz@twigeo.com', 'Grzegorz Raszewski', 'Analytics', 'Sweden'),
  ('micael@twigeo.com', 'Micael Grilo', 'Analytics', 'Sweden'),
  ('milosz@twigeo.com', 'Milosz Bolibrzuch', 'Analytics', 'Sweden'),
  ('xiuxiu@twigeo.com', 'Xiuxiu Zhu', 'Analytics', 'Sweden'),
  ('yutong@twigeo.com', 'Yutong He', 'Analytics', 'Sweden'),
  ('zahra@twigeo.com', 'Zahra Khakoo', 'Analytics', 'Sweden'),
  ('neil@twigeo.com', 'Neil Goldfluss', 'Business', 'US'),
  ('zack@twigeo.com', 'Zack Bower', 'Business', 'US'),
  ('adam@twigeo.com', 'Adam Uppermann', 'Creative', 'Sweden'),
  ('bex@twigeo.com', 'Bex Feldman', 'Creative', 'US'),
  ('brad@twigeo.com', 'Brad Johnson', 'Creative', 'US'),
  ('caisa@twigeo.com', 'Caisa Carlson', 'Creative', 'Sweden'),
  ('dan@twigeo.com', 'Dan Wirtheim', 'Creative', 'US'),
  ('emma@twigeo.com', 'Emma Zohoori', 'Creative', 'Sweden'),
  ('frans@twigeo.com', 'Frans Dino', 'Creative', 'Sweden'),
  ('gergana@twigeo.com', 'Gergana Aleksieva', 'Creative', 'Bulgaria'),
  ('lisa@twigeo.com', 'Lisa Sandahl', 'People & Culture', null)
on conflict (email) do update
  set full_name = excluded.full_name, department = excluded.department, office = excluded.office;

-- 3. Match existing profiles to the roster (a profile called "Neil" or "Neil Goldfluss" → neil@)
with m as (
  select distinct on (r.email) p.id, r.email, r.department
  from public.people r
  join public.players p
    on p.email is null
    and (lower(p.name) = lower(split_part(r.full_name, ' ', 1)) or lower(p.name) = lower(r.full_name))
  order by r.email, (lower(p.name) = lower(r.full_name)) desc, p.created_at
)
update public.players p
   set email = m.email, department = m.department
  from m
 where p.id = m.id
   and not exists (select 1 from public.players x where lower(x.email) = m.email);

-- 4. Admin, and goodbye plaintext passwords
update public.players set is_admin = true where lower(email) = 'alejandro@twigeo.com';
update public.players set password_text = null;

-- 5. Helpers used by the functions and the access rules
create or replace function public.jwt_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.is_twigeo() returns boolean
language sql stable as $$ select auth.uid() is not null and public.jwt_email() like '%@twigeo.com' $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_twigeo() and (
    public.jwt_email() = 'alejandro@twigeo.com'
    or exists (select 1 from public.players where user_id = auth.uid() and is_admin)
  )
$$;

create or replace function public.my_player_name() returns text
language sql stable security definer set search_path = public as $$
  select name from public.players where user_id = auth.uid()
$$;

-- 6. Log in: link this account to its profile, or say what's needed to make one
create or replace function public.link_my_player() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := public.jwt_email();
  p public.players%rowtype;
  r public.people%rowtype;
begin
  if not public.is_twigeo() then raise exception 'twigeo_only'; end if;

  select * into p from public.players where user_id = auth.uid();
  if found then
    return jsonb_build_object('status', 'ok', 'player', to_jsonb(p) - 'password_text');
  end if;

  update public.players set user_id = auth.uid()
   where lower(email) = e and user_id is null
   returning * into p;
  if found then
    return jsonb_build_object('status', 'ok', 'player', to_jsonb(p) - 'password_text');
  end if;

  select * into r from public.people where email = e;
  return jsonb_build_object(
    'status', 'new',
    'suggested_name', coalesce(split_part(r.full_name, ' ', 1), initcap(split_part(split_part(e, '@', 1), '.', 1))),
    'office', r.office,
    'department', r.department,
    'claimable', (
      select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'office', office, 'avatar', avatar) order by name), '[]'::jsonb)
        from public.players where email is null and user_id is null
    )
  );
end $$;

-- 7. First login: claim an existing profile that nobody has linked yet
create or replace function public.claim_player(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := public.jwt_email();
  p public.players%rowtype;
begin
  if not public.is_twigeo() then raise exception 'twigeo_only'; end if;
  if exists (select 1 from public.players where user_id = auth.uid()) then raise exception 'already_linked'; end if;
  update public.players
     set email = e, user_id = auth.uid(),
         department = coalesce(department, (select department from public.people where email = e))
    where id = p_id and email is null and user_id is null
  returning * into p;
  if not found then raise exception 'taken'; end if;
  return to_jsonb(p) - 'password_text';
end $$;

-- 8. First login: create a new profile
create or replace function public.create_my_player(p_name text, p_office text, p_avatar text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e text := public.jwt_email();
  p public.players%rowtype;
begin
  if not public.is_twigeo() then raise exception 'twigeo_only'; end if;
  if exists (select 1 from public.players where user_id = auth.uid()) then raise exception 'already_linked'; end if;
  insert into public.players (name, office, avatar, email, user_id, department)
  values (trim(p_name), p_office, p_avatar, e, auth.uid(), (select department from public.people where email = e))
  returning * into p;
  return to_jsonb(p) - 'password_text';
end $$;

-- 9. The TV (never logged in) may only move the music queue on and save the playback position
create or replace function public.tv_advance_queue(p_current uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare nxt uuid;
begin
  update public.youtube_queue
     set status = 'played', is_playing = false, played_at = now()
   where (p_current is not null and id = p_current) or (p_current is null and status = 'playing');
  select id into nxt from public.youtube_queue
    where status = 'queued' and coalesce(is_deleted, false) = false
   order by queued_at asc limit 1;
  if nxt is not null then
    update public.youtube_queue set status = 'playing', is_playing = true where id = nxt;
  end if;
end $$;

create or replace function public.tv_save_position(p_id uuid, p_seconds integer) returns void
language sql security definer set search_path = public as $$
  update public.youtube_queue set current_time_seconds = greatest(0, p_seconds)
    where id = p_id and status = 'playing'
$$;

grant execute on function public.link_my_player() to authenticated;
grant execute on function public.claim_player(uuid) to authenticated;
grant execute on function public.create_my_player(text, text, text) to authenticated;
grant execute on function public.tv_advance_queue(uuid) to anon, authenticated;
grant execute on function public.tv_save_position(uuid, integer) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;