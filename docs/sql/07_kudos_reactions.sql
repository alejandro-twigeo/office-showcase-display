-- Step 7: reactions on kudos (👏 ❤️ 😂 🎉 🙌 🔥).
-- Anyone can see them (the TV shows them); logged-in Twigeo people react in their own name,
-- once per emoji per kudos, and can take their own reaction back.
create table if not exists public.kudos_reactions (
  id uuid primary key default gen_random_uuid(),
  kudos_id uuid not null references public.positive_messages(id) on delete cascade,
  emoji text not null check (emoji in ('👏', '❤️', '😂', '🎉', '🙌', '🔥')),
  player_name text not null,
  created_at timestamptz not null default now(),
  unique (kudos_id, emoji, player_name)
);
create index if not exists kudos_reactions_kudos_idx on public.kudos_reactions (kudos_id);

alter table public.kudos_reactions enable row level security;
drop policy if exists "read: everyone" on public.kudos_reactions;
drop policy if exists "react: own name" on public.kudos_reactions;
drop policy if exists "unreact: own" on public.kudos_reactions;
create policy "read: everyone" on public.kudos_reactions for select using (true);
create policy "react: own name" on public.kudos_reactions for insert to authenticated
  with check (public.is_twigeo() and player_name = public.my_player_name());
create policy "unreact: own" on public.kudos_reactions for delete to authenticated
  using (player_name = public.my_player_name() or public.is_admin());

revoke all on public.kudos_reactions from anon, authenticated;
grant select on public.kudos_reactions to anon, authenticated;
grant insert (kudos_id, emoji, player_name) on public.kudos_reactions to authenticated;
grant delete on public.kudos_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'kudos_reactions') then
    alter publication supabase_realtime add table public.kudos_reactions;
  end if;
end $$;
