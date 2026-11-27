-- Step 5: the admin can see the team list next to who has signed up (for Usage Analytics).
-- Only the admin; everyone else gets an error. Nothing else changes.
create or replace function public.admin_roster()
returns table (email text, full_name text, department text, office text, player_name text, player_avatar text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admin_only'; end if;
  return query
    select r.email, r.full_name, r.department, r.office, p.name, p.avatar
      from public.people r
      left join public.players p on lower(p.email) = r.email
     order by r.full_name;
end $$;
revoke all on function public.admin_roster() from public, anon;
grant execute on function public.admin_roster() to authenticated;
