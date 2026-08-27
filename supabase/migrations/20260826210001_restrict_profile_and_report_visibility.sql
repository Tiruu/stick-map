drop policy if exists "Profiles are public" on public.profiles;
drop policy if exists "Profiles are readable" on public.profiles;
drop policy if exists "Authenticated users can read profiles" on public.profiles;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Authenticated users can read reports" on public.stick_reports;
drop policy if exists "Admins can read reports" on public.stick_reports;

create policy "Admins can read reports"
on public.stick_reports
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = (select auth.uid())
      and profiles.role = 'admin'
  )
);

revoke select on table public.profiles from anon;
revoke select on table public.stick_reports from anon, authenticated;

grant select on table public.profiles to authenticated;
grant select on table public.stick_reports to authenticated;