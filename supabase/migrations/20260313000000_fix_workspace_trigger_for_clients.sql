-- Fix: Only skip default workspace creation for member invites.
-- Client invites are for widget access only — those users still need their own workspace.

CREATE OR REPLACE FUNCTION public.handle_new_workspace_for_user()
RETURNS trigger AS $$
DECLARE
    new_workspace_id uuid;
    has_member_invite boolean;
BEGIN
    -- Check if the user has a pending member invite
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE email = NEW.email AND role = 'member'
    ) INTO has_member_invite;

    -- Only skip default workspace if the user is invited as a member to an existing one.
    IF NOT has_member_invite THEN
        INSERT INTO public.workspaces (name, owner_id)
        VALUES ('My Workspace', NEW.id)
        RETURNING id INTO new_workspace_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (new_workspace_id, NEW.id, 'owner');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
