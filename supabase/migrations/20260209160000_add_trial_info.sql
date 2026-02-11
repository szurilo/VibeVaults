-- Add trial_ends_at to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + interval '14 days');

-- Update the handle_new_user function to set trial_ends_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, trial_ends_at)
  VALUES (new.id, NOW() + interval '14 days');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing users trial (if any)
UPDATE public.profiles SET trial_ends_at = created_at + interval '14 days' WHERE trial_ends_at IS NULL;
