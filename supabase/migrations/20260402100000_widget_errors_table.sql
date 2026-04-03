-- Widget error tracking table
-- Captures client-side errors from the embeddable widget (public/widget.js)
-- so we can monitor widget health without loading third-party SDKs on customer sites.

create table if not exists widget_errors (
  id uuid primary key default gen_random_uuid(),
  api_key text not null,
  error_message text not null,
  error_stack text,
  url text,
  user_agent text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Index for querying errors by project (api_key) and time
create index idx_widget_errors_api_key_created on widget_errors (api_key, created_at desc);

-- Auto-cleanup: delete errors older than 30 days to prevent unbounded growth
-- Runs daily at 3:00 AM UTC
select cron.schedule(
  'cleanup_widget_errors',
  '0 3 * * *',
  $$delete from widget_errors where created_at < now() - interval '30 days'$$
);

-- RLS: no direct client access — only service role (API routes) can insert/read
alter table widget_errors enable row level security;

comment on table widget_errors is 'Client-side errors from the embeddable widget, inserted via /api/widget/errors';
