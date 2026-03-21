-- Allow non-owner members to delete their own workspace_members row (leave workspace).
-- Previously only the "Workspace owners can manage members" FOR ALL policy existed,
-- which meant non-owner deletes were silently ignored by RLS.

CREATE POLICY "Members can leave workspaces"
ON public.workspace_members FOR DELETE
USING (
    user_id = auth.uid()
);
