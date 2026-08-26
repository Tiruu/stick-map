-- Confirmations are created through confirm_stick_nearby().
-- Users may delete their own confirmation through the RLS policy.

REVOKE INSERT, UPDATE
ON public.stick_confirmations
FROM anon, authenticated;
