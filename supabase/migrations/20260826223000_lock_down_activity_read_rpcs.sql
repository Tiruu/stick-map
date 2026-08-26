revoke execute on function public.get_latest_stick_confirmation(uuid) from public;
revoke execute on function public.get_latest_stick_confirmation(uuid) from anon;
grant execute on function public.get_latest_stick_confirmation(uuid) to authenticated;

revoke execute on function public.get_latest_stick_report(uuid) from public;
revoke execute on function public.get_latest_stick_report(uuid) from anon;
revoke execute on function public.get_latest_stick_report(uuid) from authenticated;
grant execute on function public.get_latest_stick_report(uuid) to authenticated;

create or replace function private.get_latest_stick_report(p_stick_id uuid)
returns setof public.stick_reports
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  return query
    select sr.*
    from public.stick_reports as sr
    where sr.stick_id = p_stick_id
    order by sr.updated_at desc
    limit 1;
end;
$function$;
