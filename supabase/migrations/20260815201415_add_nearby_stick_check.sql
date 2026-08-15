create or replace function public.is_near_stick(
  p_stick_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters double precision default 30
)
returns boolean
language plpgsql
security definer
set search_path = public
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
        power(
          sin(
            radians(
              p_latitude - v_stick_lat
            ) / 2
          ),
          2
        ) +
        cos(radians(v_stick_lat)) *
        cos(radians(p_latitude)) *
        power(
          sin(
            radians(
              p_longitude - v_stick_lon
            ) / 2
          ),
          2
        )
      )
    );

  return v_distance_meters <= p_radius_meters;
end;
$$;