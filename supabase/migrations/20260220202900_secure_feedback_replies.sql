-- Secure feedback_replies by removing the public access policy
-- The widget API now uses a signed JWT and the service_role key to manage client replies securely.

DROP POLICY IF EXISTS "Clients can view/insert replies to their feedback" ON "public"."feedback_replies";
