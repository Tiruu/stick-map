-- Reports are created through report_stick_missing_nearby().
-- Reports are publicly readable but cannot be directly modified or deleted.

REVOKE INSERT, UPDATE, DELETE
ON public.stick_reports
FROM anon, authenticated;
