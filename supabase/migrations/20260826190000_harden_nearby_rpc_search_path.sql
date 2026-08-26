-- ============================================================
-- Harden SECURITY DEFINER nearby RPCs
-- ============================================================
--
-- These functions intentionally remain SECURITY DEFINER because
-- they perform controlled writes that the client must not be able
-- to perform directly under RLS.
--
-- Supabase recommends pinning SECURITY DEFINER functions to an
-- explicit search_path. Use an empty path and fully-qualified
-- references in the function bodies. The existing bodies already
-- qualify public relations and auth.uid(), so changing the setting
-- does not alter their business logic.

alter function public.create_stick_nearby(
  double precision,
  double precision,
  text,
  text,
  text,
  double precision,
  double precision
) set search_path = '';

alter function public.is_near_stick(
  uuid,
  double precision,
  double precision,
  double precision
) set search_path = '';

alter function public.confirm_stick_nearby(
  uuid,
  double precision,
  double precision
) set search_path = '';

alter function public.report_stick_missing_nearby(
  uuid,
  double precision,
  double precision
) set search_path = '';

alter function public.vote_on_stick_nearby(
  uuid,
  text,
  double precision,
  double precision
) set search_path = '';
