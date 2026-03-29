-- Allow 'project_deleted' in digest queue and make project_id nullable for deleted projects

-- 1. Update CHECK constraint to include 'project_deleted'
ALTER TABLE public.email_digest_queue
    DROP CONSTRAINT IF EXISTS email_digest_queue_notification_type_check;

ALTER TABLE public.email_digest_queue
    ADD CONSTRAINT email_digest_queue_notification_type_check
    CHECK (notification_type IN ('new_feedback', 'reply', 'agency_reply', 'project_created', 'project_deleted'));

-- 2. Drop the foreign key on project_id so deletion events can reference already-deleted projects
ALTER TABLE public.email_digest_queue
    DROP CONSTRAINT IF EXISTS email_digest_queue_project_id_fkey;
