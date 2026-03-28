-- Add email preference column for project deletion notifications
ALTER TABLE public.email_preferences
ADD COLUMN IF NOT EXISTS notify_project_deleted boolean NOT NULL DEFAULT true;
