-- ============================================================
-- Secure nearby actions
-- ============================================================

-- On retire les anciennes policies qui permettent
-- les INSERT/UPDATE directs depuis le client.

drop policy if exists
  "Users can confirm other users sticks"
on public.stick_confirmations;

drop policy if exists
  "Users can update own confirmations"
on public.stick_confirmations;

drop policy if exists
  "Users can report approved sticks"
on public.stick_reports;

drop policy if exists
  "Users can update own reports"
on public.stick_reports;

drop policy if exists
  "Users can vote on other users sticks"
on public.stick_validation_votes;

drop policy if exists
  "Users can update own validation vote"
on public.stick_validation_votes;


-- ============================================================
-- Confirm stick
-- ============================================================

create or replace function public.confirm_stick_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select user_id
  into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas confirmer ton propre stick';
  end if;

  if not public.is_near_stick(
    p_stick_id,
    p_latitude,
    p_longitude
  ) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_confirmations (
    stick_id,
    user_id,
    updated_at
  )
  values (
    p_stick_id,
    v_user_id,
    now()
  )
  on conflict (stick_id, user_id)
  do update set
    updated_at = now();
end;
$$;


-- ============================================================
-- Report stick missing
-- ============================================================

create or replace function public.report_stick_missing_nearby(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_stick_owner uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Utilisateur non authentifié';
  end if;

  select user_id
  into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas signaler ton propre stick';
  end if;

  if not public.is_near_stick(
    p_stick_id,
    p_latitude,
    p_longitude
  ) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_reports (
    stick_id,
    user_id,
    reason,
    updated_at
  )
  values (
    p_stick_id,
    v_user_id,
    'missing',
    now()
  )
  on conflict (stick_id, user_id)
  do update set
    reason = 'missing',
    updated_at = now();
end;
$$;


-- ============================================================
-- Validation vote
-- ============================================================

create or replace function public.vote_on_stick_nearby(
  p_stick_id uuid,
  p_vote text,
  p_latitude double precision,
  p_longitude double precision
)
returns void
language plpgsql
security definer
set search_path = public
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

  select user_id
  into v_stick_owner
  from public.sticks
  where id = p_stick_id;

  if v_stick_owner is null then
    raise exception 'Stick introuvable';
  end if;

  if v_stick_owner = v_user_id then
    raise exception 'Tu ne peux pas voter sur ton propre stick';
  end if;

  if not public.is_near_stick(
    p_stick_id,
    p_latitude,
    p_longitude
  ) then
    raise exception 'Tu dois être à proximité du stick';
  end if;

  insert into public.stick_validation_votes (
    stick_id,
    user_id,
    vote,
    updated_at
  )
  values (
    p_stick_id,
    v_user_id,
    p_vote,
    now()
  )
  on conflict (stick_id, user_id)
  do update set
    vote = excluded.vote,
    updated_at = now();
end;
$$;


-- ============================================================
-- Permissions
-- ============================================================

grant execute on function public.confirm_stick_nearby(
  uuid,
  double precision,
  double precision
) to authenticated;

grant execute on function public.report_stick_missing_nearby(
  uuid,
  double precision,
  double precision
) to authenticated;

grant execute on function public.vote_on_stick_nearby(
  uuid,
  text,
  double precision,
  double precision
) to authenticated;