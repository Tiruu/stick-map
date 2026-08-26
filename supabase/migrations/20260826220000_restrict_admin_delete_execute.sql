revoke execute on function public.delete_stick_admin(uuid) from public;
revoke execute on function public.delete_stick_admin(uuid) from anon;
grant execute on function public.delete_stick_admin(uuid) to authenticated;
