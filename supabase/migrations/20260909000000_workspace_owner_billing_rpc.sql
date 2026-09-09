-- Members must be gated on the WORKSPACE OWNER's billing state, not their own.
--
-- `profiles` RLS only ever exposes the caller's own row, so the proxy — which
-- runs on the user-scoped client — had no way to see whether the owner of an
-- invited workspace still pays. It therefore fell back to checking the viewer's
-- own subscription and explicitly exempted invited workspaces, which let every
-- member of a lapsed owner keep working for free.
--
-- This SECURITY DEFINER function exposes just enough of the owner's profile to
-- make that decision, and only for workspaces the caller is actually a member
-- of (reusing the existing get_user_workspaces() helper, so the visibility rule
-- stays in one place).
--
-- It deliberately returns the RAW billing columns instead of a boolean: the
-- "does this account have access right now" predicate lives in exactly one
-- place, hasActiveAccess() in src/lib/tier-config.ts. Re-implementing it in SQL
-- would create a second source of truth that silently drifts out of sync.

CREATE OR REPLACE FUNCTION public.get_user_workspace_billing()
RETURNS TABLE (
    workspace_id uuid,
    owner_id uuid,
    subscription_status text,
    trial_ends_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
    SELECT w.id, w.owner_id, p.subscription_status, p.trial_ends_at
    FROM public.workspaces w
    LEFT JOIN public.profiles p ON p.id = w.owner_id
    WHERE w.id IN (SELECT public.get_user_workspaces());
$$;

-- Callable only by a real session. Anon has no workspaces, so the function
-- would return an empty set anyway, but keep the surface minimal.
REVOKE EXECUTE ON FUNCTION public.get_user_workspace_billing() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_user_workspace_billing() TO authenticated;
