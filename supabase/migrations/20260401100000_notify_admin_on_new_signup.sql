-- Trigger: notify admin via email whenever a new user profile is created.
-- Uses pg_net to POST to /api/notifications/new-signup (fire-and-forget, best effort).

create or replace function notify_admin_new_signup()
returns trigger
language plpgsql
security definer
as $$
declare
    _app_url text := 'https://vibe-vaults.com';
    _secret  text := current_setting('app.signup_notify_secret', true);
begin
    perform net.http_post(
        url     := _app_url || '/api/notifications/new-signup?secret=' || coalesce(_secret, ''),
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object('email', new.email)
    );
    return new;
end;
$$;

create trigger trg_notify_admin_new_signup
after insert on profiles
for each row
execute function notify_admin_new_signup();
