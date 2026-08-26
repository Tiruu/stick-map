-- Stick creation is handled through the create_stick_nearby RPC.
-- Client roles do not need direct INSERT privileges on public.sticks.

REVOKE INSERT
ON public.sticks
FROM anon, authenticated;
