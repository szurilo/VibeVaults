-- Periodically purge sent rows from email_digest_queue.
-- Rows older than 1 hour are past the longest cooldown window (15 min) and no
-- longer affect shouldSend*Immediately() gating, so they're safe to delete.

select cron.schedule(
    'cleanup-email-digest-queue',
    '0 * * * *',
    $$delete from public.email_digest_queue where sent_at is not null and sent_at < now() - interval '1 hour'$$
);
