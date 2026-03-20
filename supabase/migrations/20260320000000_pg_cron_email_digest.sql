-- Enable pg_cron and pg_net for scheduled digest processing
-- Replaces Vercel cron (which requires Pro plan for sub-daily schedules)

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Schedule: call the digest endpoint every 15 minutes
select cron.schedule(
    'process-email-digest',
    '*/15 * * * *',
    $$select net.http_get(url := 'https://vibe-vaults.com/api/cron/digest')$$
);
