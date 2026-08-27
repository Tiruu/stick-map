create or replace function public.confirm_stick_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language sql
security definer
set search_path to ''
as $$
  select private.confirm_stick_nearby(p_stick_id, p_latitude, p_longitude);
$$;

revoke all on function public.confirm_stick_nearby(uuid, double precision, double precision) from public;
grant execute on function public.confirm_stick_nearby(uuid, double precision, double precision) to authenticated;

drop function if exists public.get_latest_stick_report(uuid);
create function public.get_latest_stick_report(p_stick_id uuid)
returns setof public.stick_reports
language sql
stable
security definer
set search_path to ''
as $$
  select sr.*
  from public.stick_reports as sr
  where sr.stick_id = p_stick_id
    and exists (
      select 1
      from public.profiles as p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  order by sr.updated_at desc
  limit 1;
$$;

revoke all on function public.get_latest_stick_report(uuid) from public;
grant execute on function public.get_latest_stick_report(uuid) to authenticated;

create or replace function public.get_latest_stick_confirmation(p_stick_id uuid)
returns setof public.stick_confirmations
language sql
stable
security definer
set search_path to ''
as $$
  select * from private.get_latest_stick_confirmation(p_stick_id);
$$;

revoke all on function public.get_latest_stick_confirmation(uuid) from public;
grant execute on function public.get_latest_stick_confirmation(uuid) to authenticated;;
