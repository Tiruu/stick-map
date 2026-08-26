create or replace function public.check_confirmation_rate_limit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  recent_count integer;
begin
  select count(*)
  into recent_count
  from public.stick_confirmations
  where user_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception 'Rate limit exceeded';
  end if;

  return new;
end;
$function$;

revoke all on function public.check_confirmation_rate_limit() from public;
revoke all on function public.check_confirmation_rate_limit() from anon;
revoke all on function public.check_confirmation_rate_limit() from authenticated;
grant execute on function public.check_confirmation_rate_limit() to service_role;

drop trigger if exists confirmation_rate_limit_trigger on public.stick_confirmations;
create trigger confirmation_rate_limit_trigger
before insert on public.stick_confirmations
for each row
execute function public.check_confirmation_rate_limit();
