-- Cumulative Fix: Notification Logic Upgrade & Widget Visibility

-- 1. Schema Extensions
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='email_preferences' AND column_name='notify_project_created') THEN
        ALTER TABLE public.email_preferences ADD COLUMN notify_project_created boolean DEFAULT true NOT NULL;
    END IF;
END $$;

-- 2. Optimize Realtime delivery
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 3. Drop and Recreate RPC to include workspace_id (required for widget emails)
DROP FUNCTION IF EXISTS public.get_project_by_api_key(text);
CREATE OR REPLACE FUNCTION public.get_project_by_api_key(key_param text) 
RETURNS TABLE(name text, id uuid, workspace_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY SELECT p.name, p.id, p.workspace_id 
    FROM public.projects p 
    WHERE p.api_key = key_param;
END;
$$;

-- 4. Update notify_new_feedback to notify all workspace members & exclude creator
CREATE OR REPLACE FUNCTION public.notify_new_feedback() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
BEGIN
    SELECT workspace_id INTO target_workspace_id FROM public.projects WHERE id = NEW.project_id;
    
    IF target_workspace_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
        SELECT 
            wm.user_id, 
            NEW.project_id, 
            NEW.id, 
            'new_feedback', 
            'New Feedback', 
            'New feedback received from ' || COALESCE(NEW.sender, 'Client')
        FROM public.workspace_members wm
        WHERE wm.workspace_id = target_workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Update notify_project_created to notify all workspace members & exclude creator
CREATE OR REPLACE FUNCTION public.notify_project_created() RETURNS trigger AS $$
BEGIN
    IF NEW.workspace_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, type, title, message)
        SELECT 
            wm.user_id, 
            NEW.id, 
            'project_created', 
            'New Project', 
            'A new project "' || NEW.name || '" has been created'
        FROM public.workspace_members wm
        WHERE wm.workspace_id = NEW.workspace_id
          AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Ensure project creation trigger exists
DROP TRIGGER IF EXISTS on_new_project ON public.projects;
CREATE TRIGGER on_new_project
    AFTER INSERT ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.notify_project_created();

-- 7. Update notify_new_reply to notify all workspace members & exclude creator
CREATE OR REPLACE FUNCTION public.notify_new_reply() RETURNS trigger AS $$
DECLARE
    target_workspace_id uuid;
    target_project_id uuid;
BEGIN
    -- Only notify if the author is 'client' (so agency members get notified)
    IF NEW.author_role = 'client' THEN
        SELECT p.workspace_id, f.project_id INTO target_workspace_id, target_project_id
        FROM public.feedbacks f
        JOIN public.projects p ON p.id = f.project_id
        WHERE f.id = NEW.feedback_id;

        IF target_workspace_id IS NOT NULL THEN
            INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
            SELECT 
                wm.user_id, 
                target_project_id, 
                NEW.feedback_id, 
                'new_reply', 
                'New Reply', 
                NEW.author_name || ' replied to a feedback'
            FROM public.workspace_members wm
            WHERE wm.workspace_id = target_workspace_id
              AND (auth.uid() IS NULL OR wm.user_id != auth.uid());
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
