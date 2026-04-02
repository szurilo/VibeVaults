-- Sync profile avatar_url and full_name when auth.users is updated (e.g. OAuth login)
-- This ensures Google OAuth avatar/name data is always reflected in the profiles table.

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.profiles SET
    avatar_url = COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      profiles.avatar_url
    ),
    full_name = COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      profiles.full_name
    )
  WHERE id = new.id;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_updated
    AFTER UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_updated();

-- Also update handle_new_user to use picture as fallback for avatar_url
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, trial_ends_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    NOW() + interval '14 days'
  );
  RETURN new;
END;
$$;
