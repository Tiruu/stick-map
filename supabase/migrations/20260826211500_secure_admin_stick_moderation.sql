-- Admin moderation must not depend on direct UPDATE privileges on public.sticks.
-- Keep the privileged write in the private schema and expose only a narrow
-- SECURITY INVOKER wrapper to authenticated clients.

create schema if not exists private;

create or replace function private.moderate_reviewed_stick(
  p_stick_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  if p_status not in ('approved', 'rejected') then
    raise exception 'Statut de modération invalide';
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'Accès réservé aux administrateurs';
  end if;

  update public.sticks
  set moderation_status = p_status
  where id = p_stick_id
    and moderation_status = 'review';

  if not found then
    raise exception 'Stick à modérer introuvable';
  end if;
end;
$$;

revoke all on function private.moderate_reviewed_stick(uuid, text)
from public, anon, authenticated;
grant execute on function private.moderate_reviewed_stick(uuid, text)
to authenticated;

grant usage on schema private to authenticated;

create or replace function public.moderate_reviewed_stick(
  p_stick_id uuid,
  p_status text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.moderate_reviewed_stick(p_stick_id, p_status);
$$;

revoke execute on function public.moderate_reviewed_stick(uuid, text)
from public, anon, authenticated;
grant execute on function public.moderate_reviewed_stick(uuid, text)
to authenticated;
