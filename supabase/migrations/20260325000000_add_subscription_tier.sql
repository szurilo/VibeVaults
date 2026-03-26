-- Add subscription_tier column to profiles.
-- null = trial or no active subscription (code treats null as 'pro' for limit checks).
ALTER TABLE profiles
  ADD COLUMN subscription_tier text DEFAULT NULL
  CHECK (subscription_tier IN ('starter', 'pro', 'business'));
