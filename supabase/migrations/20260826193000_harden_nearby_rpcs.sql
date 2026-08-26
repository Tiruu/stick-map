-- Keep the nearby security-sensitive implementations out of the exposed API schema.
-- Public RPC names remain stable for the client, but are SECURITY INVOKER wrappers.
-- The privileged work is delegated to private SECURITY DEFINER helpers.

create schema if not exists private;

-- ============================================================
-- Private proximity helper
-- ============================================================

create or replace function private.is_near_stick(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 30
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stick_lat double precision;
  v_stick_lon double precision;
  v_distance_meters double precision;
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select latitude, longitude
  into v_stick_lat, v_stick_lon
  from public.sticks
  where id = p_stick_id;

  if v_stick_lat is null or v_stick_lon is null then
    raise exception 'Stick introuvable';
  end if;

  v_distance_meters :=
    2 * 6371000 * asin(
      sqrt(
        power(sin(radians(p_latitude - v_stick_lat) / 2), 2) +
        cos(radians(v_stick_lat)) *
        cos(radians(p_latitude)) *
        power(sin(radians(p_longitude - v_stick_lon) / 2), 2)
      )
    );

  return v_distance_meters <= p_radius_meters;
end;
$$;

-- ============================================================
-- Private creation helper
-- ============================================================

create or replace function private.create_stick_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_description text,
  p_photo_path text,
  p_origin_type text,
  p_user_latitude double precision,
  p_user_longitude double precision
)
returns public.sticks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_distance_meters double precision;
  v_stick public.sticks;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  if p_origin_type not in ('seen', 'pasted') then
    raise exception 'Origine du stick invalide';
  end if;

  if p_latitude is null
     or p_longitude is null
     or p_user_latitude is null
     or p_user_longitude is null then
    raise exception 'Position GPS invalide';
  end if;

  v_distance_meters :=
    2 * 6371000 * asin(
      sqrt(
        power(sin(radians(p_latitude - p_user_latitude) / 2), 2) +
        cos(radians(p_user_latitude)) *
        cos(radians(p_latitude)) *
        power(sin(radians(p_longitude - p_user_longitude) / 2), 2)
      )
    );

  if v_distance_meters > 30 then
    raise exception 'Tu dois être à proximité de l''emplacement du stick';
  end if;

  insert into public.sticks (
    latitude,
    longitude,
    description,
    photo_path,
    user_id,
    origin_type
  )
  values (
    p_latitude,
    p_longitude,
    p_description,
    p_photo_path,
    v_user_id,
    p_origin_type
  )
  returning * into v_stick;

  return v_stick;
end;
$$;

-- ============================================================
-- Private nearby actions
-- ============================================================

create or replace function private.confirm_stick_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select user_id into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas confirmer ton propre stick';
  end if;

  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_confirmations (stick_id, user_id, updated_at)
  values (p_stick_id, v_user_id, now())
  on conflict (stick_id, user_id)
  do update set updated_at = now();
end;
$$;

create or replace function private.report_stick_missing_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select user_id into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas signaler ton propre stick';
  end if;

  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_reports (stick_id, user_id, reason, updated_at)
  values (p_stick_id, v_user_id, 'missing', now())
  on conflict (stick_id, user_id)
  do update set reason = 'missing', updated_at = now();
end;
$$;

create or replace function private.vote_on_stick_nearby(
  p_stick_id uuid,
  p_vote text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  if p_vote not in ('approve', 'reject') then
    raise exception 'Vote invalide';
  end if;

  select user_id into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas voter sur ton propre stick';
  end if;

  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_validation_votes (stick_id, user_id, vote, updated_at)
  values (p_stick_id, v_user_id, p_vote, now())
  on conflict (stick_id, user_id)
  do update set vote = excluded.vote, updated_at = now();
end;
$$;

-- ============================================================
-- Private helper permissions
-- ============================================================

revoke all on function private.is_near_stick(uuid, double precision, double precision, double precision) from public, anon, authenticated;
revoke all on function private.create_stick_nearby(double precision, double precision, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke all on function private.confirm_stick_nearby(uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function private.report_stick_missing_nearby(uuid, double precision, double precision) from public, anon, authenticated;
revoke all on function private.vote_on_stick_nearby(uuid, text, double precision, double precision) from public, anon, authenticated;

grant execute on function private.is_near_stick(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function private.create_stick_nearby(double precision, double precision, text, text, text, double precision, double precision) to authenticated;
grant execute on function private.confirm_stick_nearby(uuid, double precision, double precision) to authenticated;
grant execute on function private.report_stick_missing_nearby(uuid, double precision, double precision) to authenticated;
grant execute on function private.vote_on_stick_nearby(uuid, text, double precision, double precision) to authenticated;

grant usage on schema private to authenticated;

-- ============================================================
-- Public invoker wrappers
-- ============================================================

create or replace function public.is_near_stick(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 30
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_near_stick(p_stick_id, p_latitude, p_longitude, p_radius_meters);
$$;

create or replace function public.create_stick_nearby(
  p_latitude double precision,
  p_longitude double precision,
  p_description text,
  p_photo_path text,
  p_origin_type text,
  p_user_latitude double precision,
  p_user_longitude double precision
)
returns public.sticks
language sql
security invoker
set search_path = ''
as $$
  select private.create_stick_nearby(
    p_latitude,
    p_longitude,
    p_description,
    p_photo_path,
    p_origin_type,
    p_user_latitude,
    p_user_longitude
  );
$$;

create or replace function public.confirm_stick_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_stick_nearby(p_stick_id, p_latitude, p_longitude);
$$;

create or replace function public.report_stick_missing_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.report_stick_missing_nearby(p_stick_id, p_latitude, p_longitude);
$$;

create or replace function public.vote_on_stick_nearby(
  p_stick_id uuid,
  p_vote text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.vote_on_stick_nearby(p_stick_id, p_vote, p_latitude, p_longitude);
$$;

-- Preserve the existing client-facing execution contract: authenticated only.
revoke execute on function public.is_near_stick(uuid, double precision, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.create_stick_nearby(double precision, double precision, text, text, text, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.confirm_stick_nearby(uuid, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.report_stick_missing_nearby(uuid, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.vote_on_stick_nearby(uuid, text, double precision, double precision) from public, anon, authenticated;

grant execute on function public.is_near_stick(uuid, double precision, double precision, double precision) to authenticated;
grant execute on function public.create_stick_nearby(double precision, double precision, text, text, text, double precision, double precision) to authenticated;
grant execute on function public.confirm_stick_nearby(uuid, double precision, double precision) to authenticated;
grant execute on function public.report_stick_missing_nearby(uuid, double precision, double precision) to authenticated;
grant execute on function public.vote_on_stick_nearby(uuid, text, double precision, double precision) to authenticated;
