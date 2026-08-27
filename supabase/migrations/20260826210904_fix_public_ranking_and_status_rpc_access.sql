CREATE OR REPLACE FUNCTION public.get_stick_statuses()
  RETURNS TABLE (
    stick_id uuid,
    status text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    select * from private.get_stick_statuses();
  $function$;

REVOKE ALL ON FUNCTION public.get_stick_statuses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_stick_statuses() TO anon;
GRANT EXECUTE ON FUNCTION public.get_stick_statuses() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_stick_statuses() TO service_role;

CREATE OR REPLACE FUNCTION public.get_contributor_ranking()
  RETURNS TABLE (
    user_id uuid,
    username text,
    stick_count integer
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
    SELECT p.id AS user_id,
           p.username,
           count(s.id)::integer AS stick_count
    FROM public.profiles AS p
    JOIN public.sticks AS s
      ON s.user_id = p.id
     AND s.moderation_status = 'approved'
    GROUP BY p.id, p.username
    ORDER BY count(s.id)::integer DESC;
  $function$;

REVOKE ALL ON FUNCTION public.get_contributor_ranking() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_contributor_ranking() TO anon;
GRANT EXECUTE ON FUNCTION public.get_contributor_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contributor_ranking() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contributor_ranking() TO service_role;
