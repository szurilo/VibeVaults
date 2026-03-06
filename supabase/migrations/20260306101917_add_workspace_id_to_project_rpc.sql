-- Drop the existing function first to change the return type
DROP FUNCTION IF EXISTS "public"."get_project_by_api_key"("text");

-- Re-create the function including the workspace_id 
CREATE OR REPLACE FUNCTION "public"."get_project_by_api_key"("key_param" "text") 
RETURNS TABLE("name" "text", "id" "uuid", "owner_email" "text", "workspace_id" "uuid")
LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
    SELECT p.name, p.id, pr.email, p.workspace_id 
    FROM public.projects p 
    LEFT JOIN public.profiles pr ON p.user_id = pr.id
    WHERE p.api_key = key_param;
END;
$$;
