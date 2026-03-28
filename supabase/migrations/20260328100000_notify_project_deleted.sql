-- Notify workspace members when a project is deleted (mirrors notify_project_created)
CREATE OR REPLACE FUNCTION public.notify_project_deleted() RETURNS trigger AS $$
BEGIN
    IF OLD.workspace_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, type, title, message)
        SELECT
            wm.user_id,
            NULL,
            'project_deleted',
            'Project Deleted',
            'The project "' || OLD.name || '" has been deleted'
        FROM public.workspace_members wm
        WHERE wm.workspace_id = OLD.workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_project_deleted
    BEFORE DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_deleted();
