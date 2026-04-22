-- Fix cascade behavior on account deletion to prevent collateral data loss.
--
-- Problem 1: projects.user_id had ON DELETE CASCADE → auth.users.
--   A workspace member who created projects in someone else's workspace would
--   silently destroy those projects on account deletion. user_id is now nullable
--   with ON DELETE SET NULL so the project survives with user_id = NULL.
--
-- Problem 2: feedback_replies.user_id had ON DELETE CASCADE → auth.users
--   (set by migration 20260224103000). This deleted replies authored by the
--   departing member, losing conversation history. Changed to SET NULL so replies
--   remain intact; author_name (text) still identifies who wrote them.

-- ── 1. projects.user_id ──────────────────────────────────────────────────────

-- Make the column nullable (was NOT NULL in the original schema).
ALTER TABLE public.projects
    ALTER COLUMN user_id DROP NOT NULL;

-- Re-point the FK to SET NULL instead of CASCADE.
ALTER TABLE public.projects
    DROP CONSTRAINT IF EXISTS projects_user_id_fkey;

ALTER TABLE public.projects
    ADD CONSTRAINT projects_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

-- ── 2. feedback_replies.user_id ──────────────────────────────────────────────

ALTER TABLE public.feedback_replies
    DROP CONSTRAINT IF EXISTS feedback_replies_user_id_fkey;

ALTER TABLE public.feedback_replies
    ADD CONSTRAINT feedback_replies_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
