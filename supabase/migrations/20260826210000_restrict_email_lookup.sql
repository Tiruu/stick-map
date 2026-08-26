revoke execute on function public.find_user_by_email(text) from public;
revoke execute on function public.find_user_by_email(text) from anon;
grant execute on function public.find_user_by_email(text) to authenticated;

create or replace function public.find_user_by_email(search_email text)
returns table(id uuid, username text)
language sql
security definer
set search_path = ''
as $function$
  select p.id, p.username
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(search_email))
    and auth.uid() is not null
    and length(trim(search_email)) >= 3
  limit 1;
$function$;
