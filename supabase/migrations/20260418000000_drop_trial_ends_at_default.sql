-- Drop the default on profiles.trial_ends_at.
-- Previous migration (20260417000000_trial_starts_on_workspace_creation.sql) removed
-- `trial_ends_at` from the handle_new_user INSERT expecting the field to stay NULL,
-- but the column's own DEFAULT (now() + 14 days) was still filling it in on every
-- profile insert — so invited members still had a trial clock ticking from signup.
--
-- After this migration, trial_ends_at is NULL by default and is only populated by
-- handle_new_workspace_for_user / create_workspace when the user actually owns a
-- workspace, which is the whole point of the earlier change.

ALTER TABLE public.profiles
    ALTER COLUMN trial_ends_at DROP DEFAULT;
