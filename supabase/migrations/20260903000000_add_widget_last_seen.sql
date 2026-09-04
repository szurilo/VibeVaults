-- Tracks when a project's widget last phoned home (config GET). Lets the
-- dashboard warn before someone shares a review link to a site that does not
-- actually carry the widget snippet — without the script on the page, the
-- `?vv_review=` param is inert and the guest sees nothing at all.
-- Expand-only; written best-effort by /api/widget GET.
ALTER TABLE public.projects
    ADD COLUMN widget_last_seen_at timestamptz;
