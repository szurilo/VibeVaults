-- Drop the existing function first because we are changing the return type
DROP FUNCTION IF EXISTS "public"."get_project_by_api_key"("text");

-- Update the function to return the owner's email
CREATE OR REPLACE FUNCTION "public"."get_project_by_api_key"("key_param" "text") 
RETURNS TABLE("name" "text", "id" "uuid", "owner_email" "text")
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
    SELECT p.name, p.id, pr.email 
    FROM public.projects p 
    LEFT JOIN public.profiles pr ON p.user_id = pr.id
    WHERE p.api_key = key_param;
END;
$$;
