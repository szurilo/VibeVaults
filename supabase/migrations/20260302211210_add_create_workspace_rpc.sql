-- Create a secure RPC function to allow authenticated users to create a new workspace

CREATE OR REPLACE FUNCTION public.create_workspace(input_name text)
RETURNS uuid AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    -- Auth check
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Create the new workspace (will be owned by current user)
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (input_name, auth.uid())
    RETURNING id INTO new_workspace_id;

    -- 2. Add the user to the workspace_members table as an owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, auth.uid(), 'owner');

    -- Return the newly created workspace ID
    RETURN new_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
