-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

CREATE FUNCTION public.check_report_rate_limit()
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

GRANT ALL ON FUNCTION public.check_report_rate_limit() TO anon;

GRANT ALL ON FUNCTION public.check_report_rate_limit() TO authenticated;

GRANT ALL ON FUNCTION public.check_report_rate_limit() TO service_role;

CREATE FUNCTION public.check_stick_rate_limit()
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

GRANT ALL ON FUNCTION public.check_stick_rate_limit() TO anon;

GRANT ALL ON FUNCTION public.check_stick_rate_limit() TO authenticated;

GRANT ALL ON FUNCTION public.check_stick_rate_limit() TO service_role;

CREATE FUNCTION public.check_validation_vote_rate_limit()
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

GRANT ALL ON FUNCTION public.check_validation_vote_rate_limit() TO anon;

GRANT ALL ON FUNCTION public.check_validation_vote_rate_limit() TO authenticated;

GRANT ALL ON FUNCTION public.check_validation_vote_rate_limit() TO service_role;

CREATE FUNCTION public.find_user_by_email (
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
  select
    p.id,
    p.username
  from auth.users u
  join public.profiles p
    on p.id = u.id
  where lower(u.email) = lower(trim(search_email))
  limit 1;
$function$;

REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.find_user_by_email(text) TO authenticated;

GRANT ALL ON FUNCTION public.find_user_by_email(text) TO service_role;

CREATE FUNCTION public.handle_new_user()
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

CREATE FUNCTION public.update_my_username (
  new_username text
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.update_my_username(text) FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_my_username(text) TO authenticated;

GRANT ALL ON FUNCTION public.update_my_username(text) TO service_role;

CREATE FUNCTION public.update_stick_validation_status()
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

REVOKE ALL ON FUNCTION public.update_stick_validation_status() FROM PUBLIC;

GRANT ALL ON FUNCTION public.update_stick_validation_status() TO service_role;

CREATE TABLE public.friendships (
  id           uuid                     DEFAULT gen_random_uuid() NOT NULL,
  requester_id uuid                     NOT NULL,
  addressee_id uuid                     NOT NULL,
  status       text                     NOT NULL,
  created_at   timestamp with time zone DEFAULT now() NOT NULL,
  updated_at   timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.friendships
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_addressee_id_fkey FOREIGN KEY (addressee_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_check CHECK (requester_id <> addressee_id);

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_pkey PRIMARY KEY (id);

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.friendships
  ADD CONSTRAINT friendships_status_check CHECK (status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text]));

GRANT ALL ON public.friendships TO anon;

GRANT ALL ON public.friendships TO authenticated;

GRANT ALL ON public.friendships TO service_role;

CREATE UNIQUE INDEX friendships_requester_addressee_idx ON public.friendships (requester_id, addressee_id);

CREATE POLICY "Users can create friendship requests" ON public.friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (((requester_id = auth.uid()) AND (requester_id <> addressee_id)));

CREATE POLICY "Users can read own friendships" ON public.friendships
  FOR SELECT
  TO authenticated
  USING (((requester_id = auth.uid()) OR (addressee_id = auth.uid())));

CREATE POLICY "Users can update own friendships" ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (((requester_id = auth.uid()) OR (addressee_id = auth.uid())))
  WITH CHECK (((requester_id = auth.uid()) OR (addressee_id = auth.uid())));

CREATE TABLE public.profiles (
  id         uuid                     NOT NULL,
  username   text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  role       text                     DEFAULT 'user'::text NOT NULL
);

ALTER TABLE public.profiles
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_key UNIQUE (username);

GRANT ALL ON public.profiles TO anon;

GRANT ALL ON public.profiles TO authenticated;

GRANT ALL ON public.profiles TO service_role;

CREATE POLICY "Profiles are public" ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Profiles are readable" ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = id));

CREATE TABLE public.stick_confirmations (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  stick_id   uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stick_confirmations
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stick_confirmations
  ADD CONSTRAINT stick_confirmations_pkey PRIMARY KEY (id);

ALTER TABLE public.stick_confirmations
  ADD CONSTRAINT stick_confirmations_stick_id_user_id_key UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_confirmations
  ADD CONSTRAINT stick_confirmations_unique UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_confirmations
  ADD CONSTRAINT stick_confirmations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT ALL ON public.stick_confirmations TO anon;

GRANT ALL ON public.stick_confirmations TO authenticated;

GRANT ALL ON public.stick_confirmations TO service_role;

CREATE POLICY "Anyone can read confirmations" ON public.stick_confirmations
  FOR SELECT
  USING (true);

CREATE POLICY "Users can remove own confirmation" ON public.stick_confirmations
  FOR DELETE
  TO authenticated
  USING ((( SELECT auth.uid() AS uid) = user_id));

CREATE TABLE public.stick_reports (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  stick_id   uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  reason     text                     DEFAULT 'missing'::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stick_reports
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_pkey PRIMARY KEY (id);

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_stick_id_user_id_key UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_stick_user_unique UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_unique UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT ALL ON public.stick_reports TO anon;

GRANT ALL ON public.stick_reports TO authenticated;

GRANT ALL ON public.stick_reports TO service_role;

CREATE TRIGGER report_rate_limit_trigger
  BEFORE INSERT ON public.stick_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.check_report_rate_limit();

CREATE POLICY "Anyone can read reports" ON public.stick_reports
  FOR SELECT
  USING (true);

CREATE TABLE public.stick_validation_votes (
  id         uuid                     DEFAULT gen_random_uuid() NOT NULL,
  stick_id   uuid                     NOT NULL,
  user_id    uuid                     NOT NULL,
  vote       text                     NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.stick_validation_votes
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_pkey PRIMARY KEY (id);

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_stick_id_user_id_key UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_unique UNIQUE (stick_id, user_id);

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_vote_check CHECK (vote = ANY (ARRAY['approve'::text, 'reject'::text]));

GRANT ALL ON public.stick_validation_votes TO anon;

GRANT ALL ON public.stick_validation_votes TO authenticated;

GRANT ALL ON public.stick_validation_votes TO service_role;

CREATE TRIGGER update_stick_validation_after_vote
  AFTER INSERT OR UPDATE ON public.stick_validation_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stick_validation_status();

CREATE TRIGGER validation_vote_rate_limit_trigger
  BEFORE INSERT ON public.stick_validation_votes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_validation_vote_rate_limit();

CREATE POLICY "Authenticated users can read validation votes" ON public.stick_validation_votes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE public.sticks (
  id                uuid                     DEFAULT gen_random_uuid() NOT NULL,
  latitude          double precision         NOT NULL,
  longitude         double precision         NOT NULL,
  description       text,
  created_at        timestamp with time zone DEFAULT now() NOT NULL,
  photo_url         text,
  photo_path        text,
  user_id           uuid,
  moderation_status text                     DEFAULT 'pending'::text NOT NULL
);

CREATE POLICY "Users can confirm other users sticks" ON public.stick_confirmations
  FOR INSERT
  TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_confirmations.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'approved'::text))))));

CREATE POLICY "Users can update own confirmations" ON public.stick_confirmations
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_confirmations.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'approved'::text))))));

CREATE POLICY "Users can report approved sticks" ON public.stick_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_reports.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'approved'::text))))));

CREATE POLICY "Users can update own reports" ON public.stick_reports
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_reports.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'approved'::text))))));

CREATE POLICY "Users can update own validation vote" ON public.stick_validation_votes
  FOR UPDATE
  TO authenticated
  USING ((auth.uid() = user_id))
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_validation_votes.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'pending'::text))))));

CREATE POLICY "Users can vote on other users sticks" ON public.stick_validation_votes
  FOR INSERT
  TO authenticated
  WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.sticks
  WHERE ((sticks.id = stick_validation_votes.stick_id) AND (sticks.user_id <> auth.uid()) AND (sticks.moderation_status = 'pending'::text))))));

ALTER TABLE public.sticks
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.sticks
  ADD CONSTRAINT sticks_moderation_status_check CHECK (moderation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'review'::text, 'rejected'::text]));

ALTER TABLE public.sticks
  ADD CONSTRAINT sticks_pkey PRIMARY KEY (id);

ALTER TABLE public.stick_confirmations
  ADD CONSTRAINT stick_confirmations_stick_id_fkey FOREIGN KEY (stick_id) REFERENCES public.sticks(id) ON DELETE CASCADE;

ALTER TABLE public.stick_reports
  ADD CONSTRAINT stick_reports_stick_id_fkey FOREIGN KEY (stick_id) REFERENCES public.sticks(id) ON DELETE CASCADE;

ALTER TABLE public.stick_validation_votes
  ADD CONSTRAINT stick_validation_votes_stick_id_fkey FOREIGN KEY (stick_id) REFERENCES public.sticks(id) ON DELETE CASCADE;

ALTER TABLE public.sticks
  ADD CONSTRAINT sticks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

GRANT ALL ON public.sticks TO anon;

GRANT ALL ON public.sticks TO authenticated;

GRANT ALL ON public.sticks TO service_role;

CREATE TRIGGER stick_rate_limit_trigger
  BEFORE INSERT ON public.sticks
  FOR EACH ROW
  EXECUTE FUNCTION public.check_stick_rate_limit();

CREATE POLICY "Admins can delete sticks" ON public.sticks
  FOR DELETE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Admins can moderate sticks" ON public.sticks
  FOR UPDATE
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Admins can read all sticks" ON public.sticks
  FOR SELECT
  TO authenticated
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));

CREATE POLICY "Anyone can read approved sticks" ON public.sticks
  FOR SELECT
  USING ((moderation_status = 'approved'::text));

CREATE POLICY "Authenticated users can create sticks" ON public.sticks
  FOR INSERT
  TO authenticated
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

CREATE POLICY "Authenticated users can read pending sticks for validation" ON public.sticks
  FOR SELECT
  TO authenticated
  USING ((moderation_status = 'pending'::text));

CREATE POLICY "Users can create own sticks" ON public.sticks
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can read own sticks" ON public.sticks
  FOR SELECT
  TO authenticated
  USING ((user_id = ( SELECT auth.uid() AS uid)));

CREATE VIEW public.contributor_ranking WITH (security_invoker=true) AS SELECT p.id AS user_id,
    p.username,
    (count(s.id))::integer AS stick_count
   FROM (public.profiles p
     JOIN public.sticks s ON (((s.user_id = p.id) AND (s.moderation_status = 'approved'::text))))
  GROUP BY p.id, p.username
  ORDER BY ((count(s.id))::integer) DESC;

GRANT ALL ON public.contributor_ranking TO anon;

GRANT ALL ON public.contributor_ranking TO authenticated;

GRANT ALL ON public.contributor_ranking TO service_role;
