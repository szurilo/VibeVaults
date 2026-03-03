-- Fix: Do not auto-create a default workspace if the user has a pending invite for a workspace.

CREATE OR REPLACE FUNCTION public.handle_new_workspace_for_user()
RETURNS trigger AS $$
DECLARE
    new_workspace_id uuid;
    has_invite boolean;
BEGIN
    -- Check if the user's email has any pending workspace invites
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_invites WHERE email = NEW.email
    ) INTO has_invite;

    -- Only auto-create a default workspace if they were not invited to one
    IF NOT has_invite THEN
        INSERT INTO public.workspaces (name, owner_id)
        VALUES ('My Workspace', NEW.id)
        RETURNING id INTO new_workspace_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (new_workspace_id, NEW.id, 'owner');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
