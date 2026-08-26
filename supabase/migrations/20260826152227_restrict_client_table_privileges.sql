-- Remove PostgreSQL privileges that should never be exposed
-- to the client roles. RLS remains responsible for row-level access.

REVOKE REFERENCES, TRIGGER, TRUNCATE
ON ALL TABLES IN SCHEMA public
FROM anon, authenticated;
