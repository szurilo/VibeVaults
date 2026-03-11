-- Fix feedback_replies RLS policies: old policies checked p.user_id = auth.uid()
-- which only worked for the original project creator, not workspace members.
-- Replace with workspace-aware policies matching the feedbacks table pattern.

-- Drop old policies
DROP POLICY IF EXISTS "Users can see replies to their project feedbacks" ON public.feedback_replies;
DROP POLICY IF EXISTS "Users can insert agency replies" ON public.feedback_replies;

-- SELECT: workspace members and clients can view replies
CREATE POLICY "Workspace members and clients can view replies"
ON public.feedback_replies FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.feedbacks f
        JOIN public.projects p ON f.project_id = p.id
        WHERE f.id = feedback_replies.feedback_id
        AND (
            p.workspace_id IN (SELECT public.get_user_workspaces())
            OR
            p.id IN (SELECT public.get_client_project_ids())
        )
    )
);

-- INSERT: workspace members can insert agency replies
CREATE POLICY "Workspace members can insert agency replies"
ON public.feedback_replies FOR INSERT
WITH CHECK (
    author_role = 'agency'
    AND EXISTS (
        SELECT 1 FROM public.feedbacks f
        JOIN public.projects p ON f.project_id = p.id
        WHERE f.id = feedback_replies.feedback_id
        AND p.workspace_id IN (SELECT public.get_user_workspaces())
    )
);
