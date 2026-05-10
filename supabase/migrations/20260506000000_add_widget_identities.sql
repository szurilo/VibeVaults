-- Widget identity tokens for invite-only widget authentication.
-- Each row is one device's authorized session for a single project.
-- Multi-device by design: multiple rows per (project_id, email) are allowed.
--
-- Authorization sources:
--   * invite_id  -> client invited via workspace_invites
--   * user_id    -> owner/member from auth.users (workspace membership checked at issue time)
--
-- Revocation:
--   * Cascade on workspace_invites delete (client invite removed/replaced)
--   * Cascade on auth.users delete (account removed)
--   * Cascade on projects delete
--   * Member-removal trigger added in a follow-up migration (slice C)

CREATE TABLE IF NOT EXISTS public.widget_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    invite_id uuid REFERENCES public.workspace_invites(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz,
    CHECK (invite_id IS NOT NULL OR user_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_widget_identities_token_hash
    ON public.widget_identities (token_hash);

CREATE INDEX IF NOT EXISTS idx_widget_identities_project_email
    ON public.widget_identities (project_id, email);

CREATE INDEX IF NOT EXISTS idx_widget_identities_invite
    ON public.widget_identities (invite_id) WHERE invite_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_widget_identities_user
    ON public.widget_identities (user_id) WHERE user_id IS NOT NULL;

-- Server-only access via service role / admin client.
-- No policies = nothing reachable from anon or authenticated roles.
ALTER TABLE public.widget_identities ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.widget_identities IS
    'Per-device widget auth tokens. Bootstrapped from workspace_invites (clients) or workspace memberships (owners/members). token_hash stores sha256 of the raw token; raw token is returned only at issue time.';
