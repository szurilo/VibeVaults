-- Improve notification titles and messages + notify on all replies (not just client)

-- Update notify_new_feedback: title = "New feedback received from xyz", message = content preview
CREATE OR REPLACE FUNCTION public.notify_new_feedback() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
    sender_name text;
    content_preview text;
BEGIN
    SELECT workspace_id INTO target_workspace_id FROM public.projects WHERE id = NEW.project_id;
    sender_name := COALESCE(NEW.sender, 'Someone');
    content_preview := LEFT(NEW.content, 100);

    IF target_workspace_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
        SELECT
            wm.user_id,
            NEW.project_id,
            NEW.id,
            'new_feedback',
            'New feedback received from ' || sender_name,
            content_preview
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update notify_new_reply: title = "New reply received from xyz", message = content preview
-- Also removed the client-only check so all replies trigger notifications
CREATE OR REPLACE FUNCTION public.notify_new_reply() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
    target_project_id uuid;
    sender_name text;
    content_preview text;
BEGIN
    SELECT p.workspace_id, f.project_id INTO target_workspace_id, target_project_id
    FROM public.feedbacks f
    JOIN public.projects p ON p.id = f.project_id
    WHERE f.id = NEW.feedback_id;

    sender_name := COALESCE(NEW.author_name, 'Someone');
    content_preview := LEFT(NEW.content, 100);

    IF target_workspace_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
        SELECT
            wm.user_id,
            target_project_id,
            NEW.feedback_id,
            'new_reply',
            'New reply received from ' || sender_name,
            content_preview
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
