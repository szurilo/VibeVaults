-- Add 'mode' and 'support_email' to projects
ALTER TABLE "public"."projects" 
ADD COLUMN IF NOT EXISTS "mode" text DEFAULT 'staging' CHECK (mode IN ('staging', 'live')),
ADD COLUMN IF NOT EXISTS "support_email" text;

-- Update the function to return the mode and support_email
DROP FUNCTION IF EXISTS "public"."get_project_by_api_key"("text");

CREATE OR REPLACE FUNCTION "public"."get_project_by_api_key"("key_param" "text") 
RETURNS TABLE("name" "text", "id" "uuid", "owner_email" "text", "mode" "text", "support_email" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
    SELECT p.name, p.id, pr.email, p.mode, p.support_email
    FROM public.projects p 
    LEFT JOIN public.profiles pr ON p.user_id = pr.id
    WHERE p.api_key = key_param;
END;
$$;
