-- Add index on feedbacks.project_id for fast project-scoped queries
-- (dashboard feedback list, notification triggers, widget feedbacks endpoint)
CREATE INDEX IF NOT EXISTS idx_feedbacks_project_id ON public.feedbacks(project_id);

-- Add index on workspace_members.user_id for fast RLS helper lookups
-- (get_user_workspaces() and get_user_owned_workspaces() query by user_id on every request,
-- but the composite PK (workspace_id, user_id) only indexes workspace_id-first lookups)
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
