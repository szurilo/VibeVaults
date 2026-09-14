-- Reply pins: a reply in a thread can carry its own on-page anchor
-- ({ anchor, page_key }, the same shape feedbacks.metadata uses), so a
-- reviewer can say "same bug here too" or "still broken after the fix"
-- without opening a second thread. Nullable and additive (expand step);
-- the code that writes it ships after this migration.
ALTER TABLE public.feedback_replies
    ADD COLUMN IF NOT EXISTS metadata jsonb;

COMMENT ON COLUMN public.feedback_replies.metadata IS
    'Optional reply pin: { anchor, page_key }. Null for plain replies.';
