-- Nightly cleanup of widget_identities rows that were issued but never used.
--
-- Why: each "Open widget on site" click in the dashboard, each /access
-- recovery request, and each project-created auto-bootstrap mints a fresh
-- widget_identities row. Multi-device is intentional, but rows whose token
-- was never planted into a host-site localStorage (last_used_at IS NULL)
-- become orphans — the user's actual session is in a newer row that did
-- get used. After 7 days the orphan can never legitimately become active
-- (the raw token only lives in the URL/email it was minted into, and the
-- bootstrap link's purpose is one-shot device activation).
--
-- Rows with last_used_at populated are NEVER deleted by this job — those are
-- live sessions. Active sessions only end via the existing revocation paths
-- (workspace_invites cascade for clients, member-removal trigger for
-- owners/members, account/project deletion cascades).

select cron.schedule(
    'cleanup-unused-widget-identities',
    '0 3 * * *',  -- daily at 03:00 UTC, off-peak
    $$delete from public.widget_identities where last_used_at is null and created_at < now() - interval '7 days'$$
);
