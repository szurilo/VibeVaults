-- Add completed_onboarding_steps to track checklist progress
ALTER TABLE public.profiles
ADD COLUMN completed_onboarding_steps text[] DEFAULT '{}';
