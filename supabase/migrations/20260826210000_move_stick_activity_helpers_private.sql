-- Keep the data-access helpers out of the exposed API schema.
-- Public wrappers remain SECURITY INVOKER and only delegate to private,
-- tightly-scoped SECURITY DEFINER helpers.

drop view if exists public.stick_latest_confirmations;
drop view if exists public.stick_latest_reports;
drop view if exists public.stick_statuses;

create schema if not exists private;

create or replace function private.get_latest_stick_confirmation(p_stick_id uuid)
returns setof public.stick_confirmations
language sql
stable
security definer
set search_path = ''
as $$
  select sc.*
  from public.stick_confirmations as sc
  where sc.stick_id = p_stick_id
  order by sc.updated_at desc
  limit 1;
$$;

create or replace function private.get_latest_stick_report(p_stick_id uuid)
returns setof public.stick_reports
language sql
stable
security definer
set search_path = ''
as $$
  select sr.*
  from public.stick_reports as sr
  where sr.stick_id = p_stick_id
  order by sr.updated_at desc
  limit 1;
$$;

create or replace function private.get_stick_statuses()
returns table (stick_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  with confirmation_latest as (
    select distinct on (sc.stick_id)
      sc.stick_id,
      sc.updated_at
    from public.stick_confirmations as sc
    order by sc.stick_id, sc.updated_at desc
  ),
  report_stats as (
    select
      sr.stick_id,
      count(*)::integer as report_count,
      max(sr.updated_at) as latest_report_at
    from public.stick_reports as sr
    group by sr.stick_id
  ),
  activity as (
    select
      coalesce(rs.stick_id, cl.stick_id) as stick_id,
      coalesce(rs.report_count, 0) as report_count,
      cl.updated_at as latest_confirmation_at,
      rs.latest_report_at
    from report_stats as rs
    full outer join confirmation_latest as cl
      on cl.stick_id = rs.stick_id
  )
  select
    a.stick_id,
    case
      when a.report_count < 4 then
        case when a.latest_confirmation_at is not null then 'present' else 'unknown' end
      when a.latest_confirmation_at is null then 'missing'
      when a.latest_confirmation_at > a.latest_report_at then 'present'
      else 'missing'
    end as status
  from activity as a;
$$;

revoke all on function private.get_latest_stick_confirmation(uuid) from public, anon, authenticated;
revoke all on function private.get_latest_stick_report(uuid) from public, anon, authenticated;
revoke all on function private.get_stick_statuses() from public, anon, authenticated;
grant execute on function private.get_latest_stick_confirmation(uuid) to anon, authenticated;
grant execute on function private.get_latest_stick_report(uuid) to anon, authenticated;
grant execute on function private.get_stick_statuses() to anon, authenticated;
grant usage on schema private to anon, authenticated;

create or replace function public.get_latest_stick_confirmation(p_stick_id uuid)
returns setof public.stick_confirmations
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_latest_stick_confirmation(p_stick_id);
$$;

create or replace function public.get_latest_stick_report(p_stick_id uuid)
returns setof public.stick_reports
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_latest_stick_report(p_stick_id);
$$;

create or replace function public.get_stick_statuses()
returns table (stick_id uuid, status text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.get_stick_statuses();
$$;

revoke execute on function public.get_latest_stick_confirmation(uuid) from public, anon, authenticated;
revoke execute on function public.get_latest_stick_report(uuid) from public, anon, authenticated;
revoke execute on function public.get_stick_statuses() from public, anon, authenticated;
grant execute on function public.get_latest_stick_confirmation(uuid) to anon, authenticated;
grant execute on function public.get_latest_stick_report(uuid) to anon, authenticated;
grant execute on function public.get_stick_statuses() to anon, authenticated;
