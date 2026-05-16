-- Replace the HTTP-based admin signup notification with a queue-based one.
-- Old: trigger called pg_net → /api/notifications/new-signup (needed a shared secret
--      stored in a Postgres GUC, which broke silently on Cloud where the GUC wasn't set).
-- New: trigger inserts a row into email_digest_queue; the existing pg_cron digest job
--      drains it and sends the email. No HTTP from Postgres, no secret to manage.

DROP TRIGGER IF EXISTS trg_notify_admin_new_signup ON public.profiles;
DROP FUNCTION IF EXISTS notify_admin_new_signup();

-- Allow 'admin_new_signup' in the digest queue
ALTER TABLE public.email_digest_queue
    DROP CONSTRAINT IF EXISTS email_digest_queue_notification_type_check;

ALTER TABLE public.email_digest_queue
    ADD CONSTRAINT email_digest_queue_notification_type_check
    CHECK (notification_type IN (
        'new_feedback',
        'reply',
        'agency_reply',
        'project_created',
        'project_deleted',
        'admin_new_signup'
    ));

-- recipient_email stores the signup email for record-keeping; the cron route ignores
-- it and routes the actual email to ADMIN_EMAIL from server env.
CREATE OR REPLACE FUNCTION queue_admin_new_signup_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.email_digest_queue (recipient_email, notification_type, payload)
    VALUES (NEW.email, 'admin_new_signup', jsonb_build_object('email', NEW.email));
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_queue_admin_new_signup
    AFTER INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION queue_admin_new_signup_notification();
