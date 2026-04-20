-- Move trial start from account creation to first-workspace creation.
-- Rationale: invited members who never own a workspace should not have their
-- 14-day trial clock ticking against features they have no control over.

-- 1. handle_new_user: stop setting trial_ends_at at signup (leave it NULL).
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  RETURN new;
END;
$$;

-- 2. handle_new_workspace_for_user: start the trial when the default workspace
-- is auto-created on signup (non-member-invite path).
CREATE OR REPLACE FUNCTION public.handle_new_workspace_for_user()
RETURNS trigger AS $$
DECLARE
    new_workspace_id uuid;
    has_member_invite boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.workspace_invites
        WHERE email = NEW.email AND role = 'member'
    ) INTO has_member_invite;

    IF NOT has_member_invite THEN
        INSERT INTO public.workspaces (name, owner_id)
        VALUES ('My Workspace', NEW.id)
        RETURNING id INTO new_workspace_id;

        INSERT INTO public.workspace_members (workspace_id, user_id, role)
        VALUES (new_workspace_id, NEW.id, 'owner');

        UPDATE public.profiles
        SET trial_ends_at = NOW() + interval '14 days'
        WHERE id = NEW.id AND trial_ends_at IS NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. create_workspace RPC: start the trial when a member-only user later
-- creates their first workspace through the app.
CREATE OR REPLACE FUNCTION public.create_workspace(input_name text)
RETURNS uuid AS $$
DECLARE
    new_workspace_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    INSERT INTO public.workspaces (name, owner_id)
    VALUES (input_name, auth.uid())
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, auth.uid(), 'owner');

    UPDATE public.profiles
    SET trial_ends_at = NOW() + interval '14 days'
    WHERE id = auth.uid() AND trial_ends_at IS NULL;

    RETURN new_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
