-- Slice C migration: collapse the client-as-workspace_member model.
--
-- Under the new widget access scheme, clients are external feedback providers
-- who never sign in to Supabase auth. They exist purely as `workspace_invites`
-- rows (role='client') and `widget_identities` rows. The dashboard / RLS-aware
-- code paths only need to consider workspace members (owners + members);
-- everything client-facing flows through the widget API using the admin
-- client + bearer-token authorization.
--
-- This migration:
--   1. Recreates RLS policies on projects / feedbacks / feedback_replies
--      without the `get_client_project_ids()` clause (admin-client paths
--      already bypass RLS, so no functional regression).
--   2. Drops `get_client_project_ids()`.
--   3. Adds a CHECK constraint preventing role='client' in workspace_members
--      as defense-in-depth — the application layer will also reject this.
--   4. Adds a trigger that revokes `widget_identities` rows when a
--      workspace_members row is deleted (so removing a member from a
--      workspace immediately kills their widget access on every project
--      in that workspace).

-----------------------------------------------------------------------------
-- 1. Recreate RLS policies without the client clause
-----------------------------------------------------------------------------

DROP POLICY IF EXISTS "Workspace members and invited clients can view projects" ON public.projects;
CREATE POLICY "Workspace members can view projects"
ON public.projects FOR SELECT
USING (
    workspace_id IN (SELECT public.get_user_workspaces())
);

DROP POLICY IF EXISTS "Workspace members and clients can view feedbacks" ON public.feedbacks;
CREATE POLICY "Workspace members can view feedbacks"
ON public.feedbacks FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);

DROP POLICY IF EXISTS "Workspace members and clients can update feedbacks" ON public.feedbacks;
CREATE POLICY "Workspace members can update feedbacks"
ON public.feedbacks FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = feedbacks.project_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);

DROP POLICY IF EXISTS "Workspace members and clients can view replies" ON public.feedback_replies;
CREATE POLICY "Workspace members can view replies"
ON public.feedback_replies FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.feedbacks f
        JOIN public.projects p ON f.project_id = p.id
        WHERE f.id = feedback_replies.feedback_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);

-----------------------------------------------------------------------------
-- 2. Drop the now-unused helper
-----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_client_project_ids();

-----------------------------------------------------------------------------
-- 3. Defense-in-depth: prevent role='client' in workspace_members
-----------------------------------------------------------------------------
-- workspace_invites with role='client' is still legitimate (client invites
-- need a place to live). What we forbid is *promoting* a client into a
-- workspace_members row — clients should never gain a workspace membership.

ALTER TABLE public.workspace_members
    DROP CONSTRAINT IF EXISTS workspace_members_no_client_role;

ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_no_client_role
    CHECK (role <> 'client');

-----------------------------------------------------------------------------
-- 4. Member-removal trigger to revoke widget_identities
-----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.revoke_widget_identities_on_member_removal()
RETURNS trigger AS $$
BEGIN
    DELETE FROM public.widget_identities wi
    USING public.projects p
    WHERE wi.user_id = OLD.user_id
      AND wi.project_id = p.id
      AND p.workspace_id = OLD.workspace_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS revoke_widget_identities_after_member_removal
    ON public.workspace_members;

CREATE TRIGGER revoke_widget_identities_after_member_removal
    AFTER DELETE ON public.workspace_members
    FOR EACH ROW EXECUTE FUNCTION public.revoke_widget_identities_on_member_removal();

COMMENT ON FUNCTION public.revoke_widget_identities_on_member_removal() IS
    'Removes per-device widget tokens for an owner/member when their workspace_members row is deleted. Client-side widget tokens are revoked via the FK cascade on workspace_invites instead.';
