-- The first draft used SECURITY DEFINER RPCs to expose stick activity.
-- Public read access is intentional for the map, but views are a better fit here:
-- they expose only the latest activity and derived status without adding more
-- SECURITY DEFINER functions to the public API surface.

drop function if exists public.get_latest_stick_confirmation(uuid);
drop function if exists public.get_latest_stick_report(uuid);
drop function if exists public.get_stick_statuses();

create or replace view public.stick_latest_confirmations as
select distinct on (sc.stick_id)
  sc.id,
  sc.stick_id,
  sc.user_id,
  sc.created_at,
  sc.updated_at
from public.stick_confirmations as sc
order by sc.stick_id, sc.updated_at desc;

create or replace view public.stick_latest_reports as
select distinct on (sr.stick_id)
  sr.id,
  sr.stick_id,
  sr.user_id,
  sr.reason,
  sr.created_at,
  sr.updated_at
from public.stick_reports as sr
order by sr.stick_id, sr.updated_at desc;

create or replace view public.stick_statuses as
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

revoke all on table public.stick_latest_confirmations, public.stick_latest_reports, public.stick_statuses from public, anon, authenticated;
grant select on table public.stick_latest_confirmations, public.stick_latest_reports, public.stick_statuses to anon, authenticated;
