-- Email digest queue for batching notifications
CREATE TABLE IF NOT EXISTS public.email_digest_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    recipient_email text NOT NULL,
    notification_type text NOT NULL CHECK (notification_type IN ('new_feedback', 'reply', 'agency_reply', 'project_created')),
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    feedback_id uuid REFERENCES public.feedbacks(id) ON DELETE CASCADE,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now() NOT NULL,
    sent_at timestamptz  -- NULL = pending, non-null = already sent (used for cooldown lookups)
);

-- Indexes for digest processing and cooldown checks
CREATE INDEX idx_digest_queue_pending ON public.email_digest_queue (sent_at) WHERE sent_at IS NULL;
CREATE INDEX idx_digest_queue_cooldown ON public.email_digest_queue (recipient_email, notification_type, project_id, sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_digest_queue_reply_cooldown ON public.email_digest_queue (recipient_email, feedback_id, sent_at DESC) WHERE sent_at IS NOT NULL AND feedback_id IS NOT NULL;

-- Auto-cleanup: drop rows older than 24h (no need to keep history)
CREATE OR REPLACE FUNCTION cleanup_old_digest_queue() RETURNS trigger AS $$
BEGIN
    DELETE FROM public.email_digest_queue WHERE created_at < now() - interval '24 hours';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cleanup_digest_queue
    AFTER INSERT ON public.email_digest_queue
    FOR EACH STATEMENT
    EXECUTE FUNCTION cleanup_old_digest_queue();

-- Add email_frequency column to email_preferences
-- 'digest' = default for all users; 'realtime' = future paid tier
ALTER TABLE public.email_preferences
    ADD COLUMN IF NOT EXISTS email_frequency text NOT NULL DEFAULT 'digest'
    CHECK (email_frequency IN ('digest', 'realtime'));
