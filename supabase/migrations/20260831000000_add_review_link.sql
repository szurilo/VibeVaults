-- Shareable review links: a permanent, unguessable per-project URL that lets
-- anyone who opens it activate the widget after self-identifying with a name
-- and email (no per-person invite). Expand-only migration — no existing rows
-- change shape, defaults backfill everything.

-- Every project gets a review token automatically; the link is permanent by
-- design (category standard: Atarim/Huddlekit/Pastel never rotate share URLs).
ALTER TABLE public.projects
    ADD COLUMN review_token uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN review_feedback_paused boolean NOT NULL DEFAULT false;

-- The token is looked up on every review-link exchange.
CREATE UNIQUE INDEX projects_review_token_idx ON public.projects (review_token);

-- Identities minted through a review link are flagged so the pause toggle
-- applies only to them, never to invited clients or workspace members.
-- display_name is the self-declared reviewer name captured on first open.
ALTER TABLE public.widget_identities
    ADD COLUMN via_review boolean NOT NULL DEFAULT false,
    ADD COLUMN display_name text;

-- Review identities have neither an invite nor a user, so the original
-- "invite or user required" check must admit the third provenance.
ALTER TABLE public.widget_identities
    DROP CONSTRAINT widget_identities_check;
ALTER TABLE public.widget_identities
    ADD CONSTRAINT widget_identities_check
    CHECK (invite_id IS NOT NULL OR user_id IS NOT NULL OR via_review);
