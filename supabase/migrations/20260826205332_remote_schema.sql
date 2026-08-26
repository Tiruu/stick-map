-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

DROP POLICY "Users can update own friendships" ON public.friendships;

DROP POLICY "Profiles are public" ON public.profiles;

DROP POLICY "Profiles are readable" ON public.profiles;

DROP POLICY "Anyone can read confirmations" ON public.stick_confirmations;

DROP POLICY "Anyone can read reports" ON public.stick_reports;

CREATE SCHEMA private AUTHORIZATION postgres;

GRANT USAGE ON SCHEMA private TO authenticated;

CREATE FUNCTION private.confirm_stick_nearby (
  p_stick_id  uuid,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  select user_id into v_stick_owner from public.sticks where id = p_stick_id;
  if v_stick_owner is null then raise exception 'Stick introuvable'; end if;
  if v_stick_owner = v_user_id then raise exception 'Tu ne peux pas confirmer ton propre stick'; end if;
  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then raise exception 'Tu dois être à proximité du stick'; end if;
  insert into public.stick_confirmations (stick_id, user_id, updated_at) values (p_stick_id, v_user_id, now()) on conflict (stick_id, user_id) do update set updated_at = now();
end;
$function$;

REVOKE ALL ON FUNCTION private.confirm_stick_nearby(uuid, double precision, double precision) FROM PUBLIC;

CREATE FUNCTION private.create_stick_nearby (
  p_latitude       double precision,
  p_longitude      double precision,
  p_description    text,
  p_photo_path     text,
  p_origin_type    text,
  p_user_latitude  double precision,
  p_user_longitude double precision
)
  RETURNS public.sticks
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_distance_meters double precision;
  v_stick public.sticks;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  if p_origin_type not in ('seen', 'pasted') then raise exception 'Origine du stick invalide'; end if;
  if p_latitude is null or p_longitude is null or p_user_latitude is null or p_user_longitude is null then raise exception 'Position GPS invalide'; end if;
  v_distance_meters := 2 * 6371000 * asin(sqrt(power(sin(radians(p_latitude - p_user_latitude) / 2), 2) + cos(radians(p_user_latitude)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - p_user_longitude) / 2), 2)));
  if v_distance_meters > 30 then raise exception 'Tu dois être à proximité de l''emplacement du stick'; end if;
  insert into public.sticks (latitude, longitude, description, photo_path, user_id, origin_type)
  values (p_latitude, p_longitude, p_description, p_photo_path, v_user_id, p_origin_type)
  returning * into v_stick;
  return v_stick;
end;
$function$;

REVOKE ALL ON FUNCTION private.create_stick_nearby(double precision, double precision, text, text, text, double precision, double precision) FROM PUBLIC;

CREATE FUNCTION private.find_user_by_email (
  search_email text
)
  RETURNS TABLE (
    id       uuid,
    username text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select p.id, p.username
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(search_email))
  limit 1;
$function$;

REVOKE ALL ON FUNCTION private.find_user_by_email(text) FROM PUBLIC;

CREATE FUNCTION private.get_latest_stick_confirmation (
  p_stick_id uuid
)
  RETURNS SETOF public.stick_confirmations
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select sc.*
  from public.stick_confirmations as sc
  where sc.stick_id = p_stick_id
  order by sc.updated_at desc
  limit 1;
$function$;

REVOKE ALL ON FUNCTION private.get_latest_stick_confirmation(uuid) FROM PUBLIC;

CREATE FUNCTION private.get_latest_stick_report (
  p_stick_id uuid
)
  RETURNS SETOF public.stick_reports
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

REVOKE ALL ON FUNCTION private.get_latest_stick_report(uuid) FROM PUBLIC;

CREATE FUNCTION private.get_stick_statuses()
  RETURNS TABLE (
    stick_id uuid,
    status   text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION private.get_stick_statuses() FROM PUBLIC;

CREATE FUNCTION private.is_near_stick (
  p_stick_id      uuid,
  p_latitude      double precision,
  p_longitude     double precision,
  p_radius_meters double precision DEFAULT 30
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_stick_lat double precision;
  v_stick_lon double precision;
  v_distance_meters double precision;
begin
  if auth.uid() is null then raise exception 'Utilisateur non authentifié'; end if;
  select latitude, longitude into v_stick_lat, v_stick_lon from public.sticks where id = p_stick_id;
  if v_stick_lat is null or v_stick_lon is null then raise exception 'Stick introuvable'; end if;
  v_distance_meters := 2 * 6371000 * asin(sqrt(power(sin(radians(p_latitude - v_stick_lat) / 2), 2) + cos(radians(v_stick_lat)) * cos(radians(p_latitude)) * power(sin(radians(p_longitude - v_stick_lon) / 2), 2)));
  return v_distance_meters <= p_radius_meters;
end;
$function$;

REVOKE ALL ON FUNCTION private.is_near_stick(uuid, double precision, double precision, double precision) FROM PUBLIC;

CREATE FUNCTION private.moderate_reviewed_stick (
  p_stick_id uuid,
  p_status   text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Utilisateur non authentifié';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Statut de modération invalide';
  end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Accès réservé aux administrateurs';
  end if;
  update public.sticks set moderation_status = p_status where id = p_stick_id and moderation_status = 'review';
  if not found then raise exception 'Stick à modérer introuvable'; end if;
end;
$function$;

REVOKE ALL ON FUNCTION private.moderate_reviewed_stick(uuid, text) FROM PUBLIC;

GRANT ALL ON FUNCTION private.moderate_reviewed_stick(uuid, text) TO authenticated;

CREATE FUNCTION private.report_stick_missing_nearby (
  p_stick_id  uuid,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  select user_id into v_stick_owner from public.sticks where id = p_stick_id;
  if v_stick_owner is null then raise exception 'Stick introuvable'; end if;
  if v_stick_owner = v_user_id then raise exception 'Tu ne peux pas signaler ton propre stick'; end if;
  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then raise exception 'Tu dois être à proximité du stick'; end if;
  insert into public.stick_reports (stick_id, user_id, reason, updated_at) values (p_stick_id, v_user_id, 'missing', now()) on conflict (stick_id, user_id) do update set reason = 'missing', updated_at = now();
end;
$function$;

REVOKE ALL ON FUNCTION private.report_stick_missing_nearby(uuid, double precision, double precision) FROM PUBLIC;

CREATE FUNCTION private.vote_on_stick_nearby (
  p_stick_id  uuid,
  p_vote      text,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Utilisateur non authentifié'; end if;
  if p_vote not in ('approve', 'reject') then raise exception 'Vote invalide'; end if;
  select user_id into v_stick_owner from public.sticks where id = p_stick_id;
  if v_stick_owner is null then raise exception 'Stick introuvable'; end if;
  if v_stick_owner = v_user_id then raise exception 'Tu ne peux pas voter sur ton propre stick'; end if;
  if not private.is_near_stick(p_stick_id, p_latitude, p_longitude) then raise exception 'Tu dois être à proximité du stick'; end if;
  insert into public.stick_validation_votes (stick_id, user_id, vote, updated_at) values (p_stick_id, v_user_id, p_vote, now()) on conflict (stick_id, user_id) do update set vote = excluded.vote, updated_at = now();
end;
$function$;

REVOKE ALL ON FUNCTION private.vote_on_stick_nearby(uuid, text, double precision, double precision) FROM PUBLIC;

CREATE FUNCTION public.check_confirmation_rate_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
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

REVOKE ALL ON FUNCTION public.check_confirmation_rate_limit() FROM PUBLIC;

GRANT ALL ON FUNCTION public.check_confirmation_rate_limit() TO service_role;

CREATE OR REPLACE FUNCTION public.check_report_rate_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  recent_count integer;
begin
  select count(*)
  into recent_count
  from public.stick_reports
  where user_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if recent_count >= 20 then
    raise exception 'Rate limit exceeded';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_stick_rate_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  recent_count integer;
begin
  select count(*)
  into recent_count
  from public.sticks
  where user_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if recent_count >= 5 then
    raise exception 'Rate limit exceeded';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.check_validation_vote_rate_limit()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  recent_count integer;
begin
  select count(*)
  into recent_count
  from public.stick_validation_votes
  where user_id = auth.uid()
    and created_at > now() - interval '1 hour';

  if recent_count >= 30 then
    raise exception 'Rate limit exceeded';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_stick_nearby (
  p_stick_id  uuid,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.confirm_stick_nearby(p_stick_id, p_latitude, p_longitude); $function$;

CREATE OR REPLACE FUNCTION public.create_stick_nearby (
  p_latitude       double precision,
  p_longitude      double precision,
  p_description    text,
  p_photo_path     text,
  p_origin_type    text,
  p_user_latitude  double precision,
  p_user_longitude double precision
)
  RETURNS public.sticks
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.create_stick_nearby(p_latitude, p_longitude, p_description, p_photo_path, p_origin_type, p_user_latitude, p_user_longitude); $function$;

CREATE FUNCTION public.delete_stick_admin (
  p_stick_id uuid
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_photo_path text;
begin
  if not exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  ) then
    raise exception 'not authorized';
  end if;

  select photo_path
    into v_photo_path
  from public.sticks
  where id = p_stick_id;

  if not found then
    raise exception 'stick not found';
  end if;

  delete from public.sticks
  where id = p_stick_id;

  return v_photo_path;
end;
$function$;

REVOKE ALL ON FUNCTION public.delete_stick_admin(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.delete_stick_admin(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.delete_stick_admin(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.find_user_by_email (
  search_email text
)
  RETURNS TABLE (
    id       uuid,
    username text
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select p.id, p.username
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower(trim(search_email))
    and auth.uid() is not null
    and length(trim(search_email)) >= 3
  limit 1;
$function$;

CREATE FUNCTION public.get_latest_stick_confirmation (
  p_stick_id uuid
)
  RETURNS SETOF public.stick_confirmations
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select * from private.get_latest_stick_confirmation(p_stick_id);
$function$;

REVOKE ALL ON FUNCTION public.get_latest_stick_confirmation(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.get_latest_stick_confirmation(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_latest_stick_confirmation(uuid) TO service_role;

CREATE FUNCTION public.get_latest_stick_report (
  p_stick_id uuid
)
  RETURNS SETOF public.stick_reports
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select * from private.get_latest_stick_report(p_stick_id);
$function$;

REVOKE ALL ON FUNCTION public.get_latest_stick_report(uuid) FROM PUBLIC;

GRANT ALL ON FUNCTION public.get_latest_stick_report(uuid) TO authenticated;

GRANT ALL ON FUNCTION public.get_latest_stick_report(uuid) TO service_role;

CREATE FUNCTION public.get_stick_statuses()
  RETURNS TABLE (
    stick_id uuid,
    status   text
  )
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$
  select * from private.get_stick_statuses();
$function$;

REVOKE ALL ON FUNCTION public.get_stick_statuses() FROM PUBLIC;

GRANT ALL ON FUNCTION public.get_stick_statuses() TO anon;

GRANT ALL ON FUNCTION public.get_stick_statuses() TO authenticated;

GRANT ALL ON FUNCTION public.get_stick_statuses() TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username'
  );

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.is_near_stick (
  p_stick_id      uuid,
  p_latitude      double precision,
  p_longitude     double precision,
  p_radius_meters double precision DEFAULT 30
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SET search_path TO ''
  AS $function$ select private.is_near_stick(p_stick_id, p_latitude, p_longitude, p_radius_meters); $function$;

CREATE FUNCTION public.moderate_reviewed_stick (
  p_stick_id uuid,
  p_status   text
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.moderate_reviewed_stick(p_stick_id,p_status); $function$;

REVOKE ALL ON FUNCTION public.moderate_reviewed_stick(uuid, text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.moderate_reviewed_stick(uuid, text) TO authenticated;

GRANT ALL ON FUNCTION public.moderate_reviewed_stick(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.report_stick_missing_nearby (
  p_stick_id  uuid,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.report_stick_missing_nearby(p_stick_id, p_latitude, p_longitude); $function$;

CREATE OR REPLACE FUNCTION public.update_my_username (
  new_username text
)
  RETURNS void
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if length(trim(new_username)) < 3 then
    raise exception 'Username too short';
  end if;

  if length(trim(new_username)) > 24 then
    raise exception 'Username too long';
  end if;

  update public.profiles
  set username = trim(new_username)
  where id = auth.uid();
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_stick_validation_status()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  approve_count integer;
  reject_count integer;
begin

  select count(*)
  into approve_count
  from public.stick_validation_votes
  where stick_id = new.stick_id
    and vote = 'approve';

  select count(*)
  into reject_count
  from public.stick_validation_votes
  where stick_id = new.stick_id
    and vote = 'reject';

  if approve_count >= 3 then

    update public.sticks
    set moderation_status = 'approved'
    where id = new.stick_id
      and moderation_status = 'pending';

  elsif reject_count >= 2 then

    update public.sticks
    set moderation_status = 'review'
    where id = new.stick_id
      and moderation_status = 'pending';

  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.vote_on_stick_nearby (
  p_stick_id  uuid,
  p_vote      text,
  p_latitude  double precision,
  p_longitude double precision
)
  RETURNS void
  LANGUAGE sql
  SET search_path TO ''
  AS $function$ select private.vote_on_stick_nearby(p_stick_id, p_vote, p_latitude, p_longitude); $function$;

REVOKE DELETE, INSERT, MAINTAIN, SELECT, UPDATE ON public.friendships FROM anon;

REVOKE DELETE, UPDATE ON public.friendships FROM authenticated;

GRANT UPDATE (status, updated_at) ON public.friendships TO authenticated;

CREATE POLICY "Addressees can respond to pending friendships" ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (((addressee_id = ( SELECT auth.uid() AS uid)) AND (status = 'pending'::text)))
  WITH CHECK (((addressee_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND (requester_id IS
    NOT NULL) AND (requester_id <> addressee_id)));

REVOKE SELECT ON public.profiles FROM anon;

CREATE POLICY "Authenticated users can read profiles" ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE DELETE, MAINTAIN, SELECT ON public.stick_confirmations FROM anon;

REVOKE DELETE, MAINTAIN, SELECT ON public.stick_confirmations FROM authenticated;

CREATE TRIGGER confirmation_rate_limit_trigger
  BEFORE INSERT ON public.stick_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_confirmation_rate_limit();

CREATE POLICY "Authenticated users can read confirmations" ON public.stick_confirmations
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE MAINTAIN, SELECT ON public.stick_reports FROM anon;

REVOKE MAINTAIN ON public.stick_reports FROM authenticated;

CREATE POLICY "Admins can read reports" ON public.stick_reports
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));

REVOKE DELETE, UPDATE ON public.sticks FROM anon;

REVOKE DELETE, UPDATE ON public.sticks FROM authenticated;
