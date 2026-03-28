-- Allow workspace members (not just owners) to delete projects
DROP POLICY IF EXISTS "Only workspace owners can delete projects" ON public.projects;

CREATE POLICY "Workspace members can delete projects"
ON public.projects FOR DELETE
USING (
    workspace_id IN (SELECT public.get_user_workspaces())
);
