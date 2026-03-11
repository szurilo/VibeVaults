-- Fix get_client_project_ids() which still references the dropped project_invites table.
-- Now uses workspace_invites (role='client') joined with projects via workspace_id.
CREATE OR REPLACE FUNCTION public.get_client_project_ids()
RETURNS SETOF uuid AS $$
    SELECT p.id
    FROM public.projects p
    JOIN public.workspace_invites wi ON wi.workspace_id = p.workspace_id
    JOIN public.profiles pr ON pr.email = wi.email
    WHERE pr.id = auth.uid()
      AND wi.role = 'client';
$$ LANGUAGE sql SECURITY DEFINER;
