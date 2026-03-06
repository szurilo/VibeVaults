-- Add full_name and avatar_url to profiles
ALTER TABLE IF EXISTS "public"."profiles" 
ADD COLUMN IF NOT EXISTS "full_name" text,
ADD COLUMN IF NOT EXISTS "avatar_url" text;

-- Update the handle_new_user function to include full_name and avatar_url from raw_user_meta_data
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, trial_ends_at)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    NOW() + interval '14 days'
  );
  RETURN new;
END;
$$;
