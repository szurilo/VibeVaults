-- Security hardening pass addressing Supabase Advisor warnings:
--   * function_search_path_mutable (16 functions)
--   * anon/authenticated_security_definer_function_executable (revoke EXECUTE
--     from trigger-only functions and tighten RPC-callable ones)
--   * rls_policy_always_true on feedbacks INSERT (replace with workspace-member gate)
--
-- Also:
--   * Drops the legacy "Anon can view feedback replies" policy + its anon grant
--     (widget moved from Supabase Realtime to server-side SSE long ago)
--   * Revokes blanket anon grants on feedbacks/profiles/projects/feedback_replies
--     (widget routes go through admin client; dashboard goes through authenticated)
--   * Adds explicit grants to tables that previously relied on Supabase's default
--     grant behavior, defending against the Oct 30 2026 PostgREST default change
--   * Explicitly revokes grants from server-only tables for the same reason

-----------------------------------------------------------------------------
-- 1. Pin search_path on every SECURITY DEFINER / trigger function
-----------------------------------------------------------------------------
-- Prevents search_path hijacking attacks (e.g., a temporary schema shadowing
-- public.notifications). Functions are unaffected functionally.

ALTER FUNCTION public.cleanup_old_digest_queue()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.get_project_by_api_key(text)               SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_workspaces()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_owned_workspaces()                SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_user_email_update()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.queue_admin_new_signup_notification()      SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_new_feedback()                      SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_project_created()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_new_reply()                         SET search_path = public, pg_temp;
ALTER FUNCTION public.notify_project_deleted()                   SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_workspace_for_user()            SET search_path = public, pg_temp;
ALTER FUNCTION public.create_workspace(text)                     SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user()                          SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_updated_at()                        SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_auth_user_updated()                 SET search_path = public, pg_temp;
ALTER FUNCTION public.revoke_widget_identities_on_member_removal() SET search_path = public, pg_temp;

-----------------------------------------------------------------------------
-- 2. Revoke EXECUTE on functions that should never be RPC-callable
-----------------------------------------------------------------------------
-- These are trigger-only functions (or internal helpers) — they fire as
-- triggers regardless of grants, but exposing them via /rest/v1/rpc/* lets
-- any anon or authenticated client invoke them directly. None of them take
-- arguments callers can supply usefully, but defense-in-depth.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_workspace_for_user()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()                        FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_updated()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_email_update()                 FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_feedback()                      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_reply()                         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_project_created()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_project_deleted()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_widget_identities_on_member_removal() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_admin_new_signup_notification()      FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_digest_queue()                 FROM PUBLIC, anon, authenticated;

-----------------------------------------------------------------------------
-- 3. Tighten RPC-callable SECURITY DEFINER functions
-----------------------------------------------------------------------------

-- create_workspace: called from a server action with a real session. The
-- function asserts auth.uid() IS NOT NULL itself, but we revoke from anon
-- so it can't even reach the assertion.
REVOKE EXECUTE ON FUNCTION public.create_workspace(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_workspace(text) TO authenticated;

-- get_project_by_api_key: only invoked server-side from validateApiKey().
-- After the accompanying widget-helpers.ts change, this runs via the admin
-- client, so neither anon nor authenticated needs EXECUTE.
REVOKE EXECUTE ON FUNCTION public.get_project_by_api_key(text) FROM PUBLIC, anon, authenticated;

-- get_user_workspaces / get_user_owned_workspaces: referenced inside RLS
-- policies on projects, feedbacks, feedback_replies, workspace_invites etc.
-- An authenticated caller hitting those tables MUST be able to execute these
-- helpers (RLS policy evaluation runs as the calling role, not the function
-- owner). Revoke from anon only. The Advisor will keep warning on the
-- authenticated grant; that's accepted — the functions return the caller's
-- own (auth.uid()-scoped) data and leak nothing extra over a normal query.
REVOKE EXECUTE ON FUNCTION public.get_user_workspaces()        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_owned_workspaces()  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_workspaces()        TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_user_owned_workspaces()  TO authenticated;

-----------------------------------------------------------------------------
-- 4. Replace the wide-open feedbacks INSERT policy
-----------------------------------------------------------------------------
-- "Public can insert feedback" was a legacy from when widget.js hit Supabase
-- directly with the anon key. Today the widget POSTs to /api/widget which
-- uses the admin client (bypasses RLS). The only remaining caller through
-- an authenticated session is addManualFeedbackAction (workspace member
-- adding feedback from the dashboard), so we replace the WITH CHECK (true)
-- policy with a workspace-member gate.

DROP POLICY IF EXISTS "Public can insert feedback" ON public.feedbacks;

CREATE POLICY "Workspace members can insert feedbacks"
ON public.feedbacks FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);

-----------------------------------------------------------------------------
-- 5. Drop the legacy anon SELECT on feedback_replies
-----------------------------------------------------------------------------
-- This existed so the widget's old anon-key Supabase Realtime subscription
-- could receive postgres_changes events. Widget now uses /api/widget/stream
-- (server-side SSE), so anon never reads feedback_replies directly.

DROP POLICY IF EXISTS "Anon can view feedback replies" ON public.feedback_replies;

-----------------------------------------------------------------------------
-- 6. Revoke blanket anon grants on the four tables that had GRANT ALL TO anon
-----------------------------------------------------------------------------
-- RLS gates rows, but minimum-privilege says table-level grants shouldn't
-- include anon when no code path uses the anon role to touch these tables.
-- All widget routes use the admin client; all dashboard code uses
-- authenticated sessions.

REVOKE ALL ON TABLE public.feedbacks         FROM anon;
REVOKE ALL ON TABLE public.profiles          FROM anon;
REVOKE ALL ON TABLE public.projects          FROM anon;
REVOKE ALL ON TABLE public.feedback_replies  FROM anon;

-----------------------------------------------------------------------------
-- 7. Explicit grants on tables that previously relied on default-privilege
-----------------------------------------------------------------------------
-- Supabase is removing the auto-grant default for public-schema tables on
-- Oct 30, 2026 (for new tables in existing projects). Existing tables keep
-- their current grants, but a fresh `supabase db reset` / branch DB rebuild
-- after that date would leave these tables invisible to PostgREST. Make the
-- grants explicit now so the migrations are reset-safe.

-- Tables accessed via authenticated supabase-js (RLS gates rows):
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_members    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_invites    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_attachments TO authenticated;

-- Tables that should be reachable only via the admin client. RLS is already
-- enabled-with-no-policies on most of these, so even with table grants the
-- anon/authenticated roles get zero rows. Revoking the grants makes intent
-- explicit and survives the Oct 30 default-change.
REVOKE ALL ON TABLE public.email_preferences   FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_digest_queue  FROM anon, authenticated;
REVOKE ALL ON TABLE public.widget_errors       FROM anon, authenticated;
REVOKE ALL ON TABLE public.widget_identities   FROM anon, authenticated;
