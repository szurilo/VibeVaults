-- Add has_onboarded to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_onboarded BOOLEAN DEFAULT FALSE;
