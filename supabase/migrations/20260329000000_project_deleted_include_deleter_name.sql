-- Include deleter's name in project_deleted bell notifications
CREATE OR REPLACE FUNCTION public.notify_project_deleted() RETURNS trigger AS $$
DECLARE
    deleter_name text;
BEGIN
    IF OLD.workspace_id IS NOT NULL THEN
        -- Look up the deleter's email to use as a display name
        SELECT SPLIT_PART(u.email, '@', 1) INTO deleter_name
        FROM auth.users u
        WHERE u.id = auth.uid();

        INSERT INTO public.notifications (user_id, project_id, type, title, message)
        SELECT
            wm.user_id,
            NULL,
            'project_deleted',
            'Project Deleted',
            COALESCE(deleter_name, 'A team member') || ' deleted the project "' || OLD.name || '"'
        FROM public.workspace_members wm
        WHERE wm.workspace_id = OLD.workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
