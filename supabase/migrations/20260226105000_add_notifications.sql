CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    feedback_id uuid REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    type text NOT NULL, -- 'new_feedback', 'new_reply'
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (id)
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications" ON public.notifications
    FOR ALL USING (user_id = auth.uid());

-- Enable real-time for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Optional index
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Trigger for new feedback
CREATE OR REPLACE FUNCTION notify_new_feedback() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
    SELECT 
        user_id, 
        NEW.project_id, 
        NEW.id, 
        'new_feedback', 
        'New Feedback', 
        'New feedback received from ' || NEW.sender
    FROM public.projects
    WHERE id = NEW.project_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_feedback
    AFTER INSERT ON public.feedbacks
    FOR EACH ROW EXECUTE FUNCTION notify_new_feedback();

-- Trigger for new reply
CREATE OR REPLACE FUNCTION notify_new_reply() RETURNS trigger AS $$
BEGIN
    -- Only notify if the author is 'client' (so agency gets notified)
    IF NEW.author_role = 'client' THEN
        INSERT INTO public.notifications (user_id, project_id, feedback_id, type, title, message)
        SELECT 
            p.user_id, 
            f.project_id, 
            NEW.feedback_id, 
            'new_reply', 
            'New Reply', 
            NEW.author_name || ' replied to a feedback'
        FROM public.feedbacks f
        JOIN public.projects p ON p.id = f.project_id
        WHERE f.id = NEW.feedback_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_new_reply
    AFTER INSERT ON public.feedback_replies
    FOR EACH ROW EXECUTE FUNCTION notify_new_reply();
