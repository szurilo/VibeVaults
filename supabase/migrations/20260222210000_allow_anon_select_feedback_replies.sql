-- Allow anon role to SELECT feedback_replies so that Supabase Realtime
-- can deliver postgres_changes events to unauthenticated widget clients.
-- Security note: The widget API validates API key ownership before
-- streaming replies, so the RLS gate here is intentionally open for SELECT.
-- The anon role still cannot INSERT (agency-only policy requires auth.uid()).

CREATE POLICY "Anon can view feedback replies"
ON "public"."feedback_replies"
FOR SELECT
TO anon
USING (true);
