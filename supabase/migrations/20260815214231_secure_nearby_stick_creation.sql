-- ============================================================
-- Secure stick creation near the user's real location
-- ============================================================

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
language plpgsql
security definer
set search_path = public
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
        power(
          sin(
            radians(
              p_latitude - p_user_latitude
            ) / 2
          ),
          2
        ) +
        cos(radians(p_user_latitude)) *
        cos(radians(p_latitude)) *
        power(
          sin(
            radians(
              p_longitude - p_user_longitude
            ) / 2
          ),
          2
        )
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
  returning *
  into v_stick;

  return v_stick;
end;
$$;


grant execute on function public.create_stick_nearby(
  double precision,
  double precision,
  text,
  text,
  text,
  double precision,
  double precision
) to authenticated;


-- Les créations passent désormais uniquement
-- par la fonction sécurisée.
drop policy if exists
  "Authenticated users can create sticks"
on public.sticks;

drop policy if exists
  "Users can create own sticks"
on public.sticks;