-- Make project_id nullable on notifications table
-- to support workspace-level notifications (member removed, member left)
-- that are not tied to a specific project.

ALTER TABLE public.notifications
    ALTER COLUMN project_id DROP NOT NULL;
