-- Prevent self-notification when owners/members submit feedback or replies via the widget.
-- Widget requests have no auth.uid(), so the existing auth.uid() check doesn't work.
-- This adds a secondary exclusion by looking up the sender's user_id from their email.

CREATE OR REPLACE FUNCTION public.notify_new_feedback() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
    sender_name text;
    sender_user_id uuid;
    content_preview text;
BEGIN
    SELECT workspace_id INTO target_workspace_id FROM public.projects WHERE id = NEW.project_id;
    sender_name := COALESCE(NEW.sender, 'Someone');
    content_preview := LEFT(NEW.content, 100);

    -- Look up sender's user_id by email to prevent self-notification (covers widget context)
    IF NEW.sender IS NOT NULL THEN
        SELECT id INTO sender_user_id FROM public.profiles WHERE email = NEW.sender;
    END IF;

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
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid())
          AND (sender_user_id IS NULL OR wm.user_id != sender_user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.notify_new_reply() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
    target_project_id uuid;
    sender_name text;
    sender_user_id uuid;
    content_preview text;
BEGIN
    SELECT p.workspace_id, f.project_id INTO target_workspace_id, target_project_id
    FROM public.feedbacks f
    JOIN public.projects p ON p.id = f.project_id
    WHERE f.id = NEW.feedback_id;

    sender_name := COALESCE(NEW.author_name, 'Someone');
    content_preview := LEFT(NEW.content, 100);

    -- Look up author's user_id by email to prevent self-notification (covers widget context)
    IF NEW.author_name IS NOT NULL THEN
        SELECT id INTO sender_user_id FROM public.profiles WHERE email = NEW.author_name;
    END IF;

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
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid())
          AND (sender_user_id IS NULL OR wm.user_id != sender_user_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
