-- Enable RLS on email_digest_queue (server-only table).
-- No policies needed — accessed exclusively via service role (bypasses RLS).
-- This prevents any PostgREST access through anon/authenticated roles.
ALTER TABLE public.email_digest_queue ENABLE ROW LEVEL SECURITY;
