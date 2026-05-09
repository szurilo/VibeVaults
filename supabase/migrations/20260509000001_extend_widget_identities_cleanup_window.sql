-- Extend the unused-widget-identities cleanup window from 7 days to 30 days.
--
-- Why: a member or client returning from a multi-week vacation should still
-- find the bootstrap link in their welcome / project-created / member-onboarding
-- email working. Under a 7-day window, a token issued just before they leave
-- gets purged before they return, and clicking the link 401s the widget. A
-- 30-day window covers typical vacation lengths while still keeping the table
-- from accumulating orphans indefinitely.
--
-- Active sessions (last_used_at IS NOT NULL) are still never touched; only
-- the threshold for purging *unused* tokens changes.

select cron.unschedule('cleanup-unused-widget-identities');

select cron.schedule(
    'cleanup-unused-widget-identities',
    '0 3 * * *',  -- daily at 03:00 UTC, off-peak
    $$delete from public.widget_identities where last_used_at is null and created_at < now() - interval '30 days'$$
);
